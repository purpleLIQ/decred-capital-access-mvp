import type { ArbiterCaseStore } from "./arbiter-case-store";
import { arbiterCaseStore } from "./arbiter-case-store";
import {
  createAllowedArbiterActions,
  createArbiterCaseId,
  type ArbiterCasePriority,
  type ArbiterCaseType,
  type ArbiterReviewCase,
} from "./arbiter-review-cases";
import { getAffectedLifecycleSection, type HeadlessLifecycleEvent } from "./headless-lifecycle-events";
import type { HeadlessLoanLifecycleRecord } from "./headless-loan-lifecycle";
import type { LifecycleEventIntegrityResult } from "./lifecycle-event-integrity";

export interface IntegrityReviewMetadata {
  recommended: boolean;
  action?: "none" | "opened" | "linked";
  caseId?: string;
  caseType?: ArbiterCaseType;
  borrowerSummary?: string;
  operatorSummary?: string;
}

export function attachIntegrityReviewMetadataToEvent(event: HeadlessLifecycleEvent, review: IntegrityReviewMetadata): HeadlessLifecycleEvent {
  return {
    ...event,
    payload: {
      ...event.payload,
      integrityReview: review,
    },
  };
}

export interface IntegrityReviewIntent {
  recommended: boolean;
  caseType?: ArbiterCaseType;
  priority?: ArbiterCasePriority;
  reason?: string;
  borrowerSummary?: string;
  operatorSummary?: string;
}

export function deriveIntegrityReviewIntent(input: {
  event: HeadlessLifecycleEvent;
  integrity: LifecycleEventIntegrityResult;
}): IntegrityReviewIntent {
  const event = input.event;
  const integrity = input.integrity;

  if (integrity.status === "accepted" || integrity.status === "duplicate" || integrity.status === "replayed") {
    return {
      recommended: false,
      borrowerSummary: "No review needed",
      operatorSummary: `Integrity status ${integrity.status} does not require a review case.`,
    };
  }

  if (integrity.status === "contradictory" && event.kind === "repayment_observed") {
    return intent("repayment_dispute", "high", "Repayment review open", "Repayment integrity failure requires review.");
  }

  if (integrity.status === "stale" && isWatcherEvent(event)) {
    return intent("watcher_stale_or_reorged", "high", "Review in progress", "Watcher integrity failure requires review.");
  }

  if (integrity.status === "stale" && isOracleOrLiquidationEvent(event)) {
    return intent("liquidation_health_review", "high", "Loan health review open", "Oracle/liquidation-health integrity failure requires review.");
  }

  if (integrity.status === "out_of_order" && event.kind === "repayment_observed") {
    return intent("repayment_dispute", "high", "Repayment review open", "Out-of-order repayment event requires review.");
  }

  if (integrity.status === "out_of_order" && isArbiterEvent(event)) {
    return intent("manual_review", "medium", "Review in progress", "Out-of-order arbiter event requires manual review.");
  }

  if (integrity.status === "unsafe_transition" && isCollateralEvent(event)) {
    return intent("collateral_issue", "high", "Collateral review open", "Unsafe collateral transition requires review.");
  }

  if (integrity.status === "unsafe_transition" && isOracleOrLiquidationEvent(event)) {
    return intent("liquidation_health_review", "urgent", "Loan health review open", "Unsafe liquidation-health transition requires review.");
  }

  if (integrity.status === "missing_required_context" || integrity.status === "needs_manual_review" || integrity.manualReviewRecommended) {
    return intent("manual_review", "medium", "Review in progress", "Integrity failure requires manual review.");
  }

  return {
    recommended: false,
    borrowerSummary: "No review needed",
    operatorSummary: `Integrity status ${integrity.status} did not map to a review case.`,
  };
}

export async function routeIntegrityReview(input: {
  event: HeadlessLifecycleEvent;
  record: HeadlessLoanLifecycleRecord;
  integrity: LifecycleEventIntegrityResult;
  arbiterStore?: ArbiterCaseStore;
}): Promise<IntegrityReviewMetadata> {
  const intent = deriveIntegrityReviewIntent({ event: input.event, integrity: input.integrity });
  if (!intent.recommended || !intent.caseType) {
    return {
      recommended: false,
      action: "none",
      borrowerSummary: intent.borrowerSummary,
      operatorSummary: intent.operatorSummary,
    };
  }

  const store = input.arbiterStore ?? arbiterCaseStore;
  const existing = await findOpenCase(store, input.record.lookupCode, intent.caseType);
  if (existing) {
    const linked = mergeIntegrityEvent(existing, input.event, input.integrity, intent);
    await store.upsert(linked);
    return {
      recommended: true,
      action: "linked",
      caseId: linked.caseId,
      caseType: linked.caseType,
      borrowerSummary: linked.borrowerSafeSummary,
      operatorSummary: `Linked integrity event ${input.event.id} to existing ${linked.caseType} case ${linked.caseId}.`,
    };
  }

  const reviewCase = createIntegrityReviewCase({
    record: input.record,
    event: input.event,
    integrity: input.integrity,
    intent,
  });
  await store.upsert(reviewCase);
  return {
    recommended: true,
    action: "opened",
    caseId: reviewCase.caseId,
    caseType: reviewCase.caseType,
    borrowerSummary: reviewCase.borrowerSafeSummary,
    operatorSummary: `Opened ${reviewCase.caseType} case ${reviewCase.caseId} from integrity status ${input.integrity.status}.`,
  };
}

function intent(caseType: ArbiterCaseType, priority: ArbiterCasePriority, borrowerSummary: string, operatorSummary: string): IntegrityReviewIntent {
  return {
    recommended: true,
    caseType,
    priority,
    reason: operatorSummary,
    borrowerSummary,
    operatorSummary,
  };
}

async function findOpenCase(store: ArbiterCaseStore, lookupCode: string, caseType: ArbiterCaseType): Promise<ArbiterReviewCase | null> {
  const cases = await store.listByLookupCode(lookupCode, 100);
  return cases.find((reviewCase) => reviewCase.caseType === caseType && !["resolved", "closed"].includes(reviewCase.status)) ?? null;
}

function createIntegrityReviewCase(input: {
  record: HeadlessLoanLifecycleRecord;
  event: HeadlessLifecycleEvent;
  integrity: LifecycleEventIntegrityResult;
  intent: IntegrityReviewIntent;
}): ArbiterReviewCase {
  const caseType = input.intent.caseType ?? "manual_review";
  const caseId = createArbiterCaseId(input.record.lookupCode, caseType);
  const evidenceReady = input.record.evidenceBundle.status !== "placeholder" || input.record.evidenceBundle.timestamp.status === "verified" || input.record.evidenceBundle.timestamp.status === "anchored";
  const status = evidenceReady ? "queued" : "evidence_needed";
  const priority = input.intent.priority ?? "medium";
  const relatedLifecycleEventIds = [input.event.id];
  const relatedWatcherEventIds = input.event.payload.watcherEventId ? [input.event.payload.watcherEventId] : [];

  return {
    caseId,
    lookupCode: input.record.lookupCode,
    caseType,
    status,
    priority,
    reason: input.intent.reason ?? `Integrity ${input.integrity.status} requires review.`,
    relatedLifecycleStatus: input.record.lifecycleStatus,
    relatedLifecycleEventIds,
    relatedWatcherEventIds,
    relatedEvidenceBundleId: input.record.evidenceBundle.bundleId,
    relatedEvidenceHash: input.record.evidenceBundle.timestamp.evidenceHash || undefined,
    evidenceTimestampStatus: input.record.evidenceBundle.timestamp.status,
    borrowerSafeSummary: input.intent.borrowerSummary ?? "Review in progress",
    arbiterInternalSummary: operatorSummary(input.event, input.integrity, input.intent),
    openedAt: input.event.observedAt,
    updatedAt: input.event.createdAt,
    reviewDeadlineAt: addHours(input.event.createdAt, 48),
    assignedArbiter: "arbiter-unassigned",
    allowedActions: createAllowedArbiterActions({
      caseId,
      caseType,
      status,
      evidenceReady,
      repaymentObserved: input.record.repaymentDetection.status === "detected" || input.record.repaymentDetection.status === "partial",
      liquidationReview: caseType === "liquidation_health_review",
    }),
    decisions: [],
    safetyAuditNote: "Integrity review case is review scaffolding only. It does not execute liquidation, sign transactions, broadcast transactions, or move funds.",
  };
}

function mergeIntegrityEvent(
  existing: ArbiterReviewCase,
  event: HeadlessLifecycleEvent,
  integrity: LifecycleEventIntegrityResult,
  intent: IntegrityReviewIntent,
): ArbiterReviewCase {
  return {
    ...existing,
    updatedAt: event.createdAt,
    relatedLifecycleEventIds: unique([...existing.relatedLifecycleEventIds, event.id]),
    relatedWatcherEventIds: unique([...existing.relatedWatcherEventIds, event.payload.watcherEventId].filter(Boolean) as string[]),
    arbiterInternalSummary: `${existing.arbiterInternalSummary} Linked integrity ${integrity.status}: ${intent.operatorSummary ?? integrity.reason}`,
  };
}

function operatorSummary(event: HeadlessLifecycleEvent, integrity: LifecycleEventIntegrityResult, intent: IntegrityReviewIntent): string {
  return [
    intent.operatorSummary ?? `Integrity ${integrity.status} requires review.`,
    `Event ${event.id}; kind ${event.kind}; section ${getAffectedLifecycleSection(event.kind)}.`,
    `Reason: ${integrity.reason}`,
    "No signing, broadcast, liquidation execution, collateral release execution, or funds movement is authorized.",
  ].join(" ");
}

function isWatcherEvent(event: HeadlessLifecycleEvent): boolean {
  return event.source === "watcher" || Boolean(event.payload.watcherEventId || event.payload.decredWatcherKind || event.payload.borrowAssetWatcherKind);
}

function isOracleOrLiquidationEvent(event: HeadlessLifecycleEvent): boolean {
  return event.source === "oracle" || event.kind === "oracle_price_observed" || event.kind === "liquidation_health_updated" || event.kind === "borrower_warning_opened" || event.kind === "top_up_requested" || event.kind === "liquidation_review_confirmed";
}

function isCollateralEvent(event: HeadlessLifecycleEvent): boolean {
  return event.kind === "collateral_lock_observed" || event.payload.collateralVerifierStatus !== undefined;
}

function isArbiterEvent(event: HeadlessLifecycleEvent): boolean {
  return event.source === "arbiter" || event.kind === "arbiter_review_requested" || event.kind === "arbiter_review_resolved";
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
}
