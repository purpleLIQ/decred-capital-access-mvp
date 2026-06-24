import type { HeadlessLoanLifecycleRecord } from "./headless-loan-lifecycle";
import type { AffectedLifecycleSection, HeadlessLifecycleEvent, LifecycleEventIntegrityStatus } from "./headless-lifecycle-events";
import { getAffectedLifecycleSection } from "./headless-lifecycle-events";

export interface LifecycleStatusSummary {
  lifecycleStatus: HeadlessLoanLifecycleRecord["lifecycleStatus"];
  collateralLock: HeadlessLoanLifecycleRecord["collateralLock"]["status"];
  dcrPlatformFeeOutput: HeadlessLoanLifecycleRecord["dcrPlatformFeeOutput"]["status"];
  supplierDisbursement: HeadlessLoanLifecycleRecord["supplierDisbursement"]["status"];
  repaymentDetection: HeadlessLoanLifecycleRecord["repaymentDetection"]["status"];
  liquidationHealth: HeadlessLoanLifecycleRecord["liquidationHealth"]["status"];
  arbiterReview: HeadlessLoanLifecycleRecord["arbiterReview"]["status"];
  evidenceBundle: HeadlessLoanLifecycleRecord["evidenceBundle"]["status"];
  lastUpdatedAt: string;
}

export interface LifecycleEventIntegrityResult {
  eventId: string;
  lookupCode: string;
  status: LifecycleEventIntegrityStatus;
  applied: boolean;
  reason: string;
  affectedLifecycleSections: AffectedLifecycleSection[];
  previousStatusSummary: LifecycleStatusSummary;
  nextStatusSummary?: LifecycleStatusSummary;
  auditNote: string;
  manualReviewRecommended: boolean;
}

export function summarizeLifecycle(record: HeadlessLoanLifecycleRecord): LifecycleStatusSummary {
  return {
    lifecycleStatus: record.lifecycleStatus,
    collateralLock: record.collateralLock.status,
    dcrPlatformFeeOutput: record.dcrPlatformFeeOutput.status,
    supplierDisbursement: record.supplierDisbursement.status,
    repaymentDetection: record.repaymentDetection.status,
    liquidationHealth: record.liquidationHealth.status,
    arbiterReview: record.arbiterReview.status,
    evidenceBundle: record.evidenceBundle.status,
    lastUpdatedAt: record.timestamps.lastUpdatedAt,
  };
}

export function createAppliedIntegrityResult(input: {
  event: HeadlessLifecycleEvent;
  previousRecord: HeadlessLoanLifecycleRecord;
  nextRecord: HeadlessLoanLifecycleRecord;
}): LifecycleEventIntegrityResult {
  return {
    eventId: input.event.id,
    lookupCode: input.event.lookupCode,
    status: "accepted",
    applied: true,
    reason: "Lifecycle event accepted and applied through the integrity-checked transition path.",
    affectedLifecycleSections: [getAffectedLifecycleSection(input.event.kind)],
    previousStatusSummary: summarizeLifecycle(input.previousRecord),
    nextStatusSummary: summarizeLifecycle(input.nextRecord),
    auditNote: "Event passed duplicate, replay, staleness, and transition-safety checks before state mutation.",
    manualReviewRecommended: false,
  };
}

export function validateLifecycleEventIntegrity(input: {
  event: HeadlessLifecycleEvent;
  record: HeadlessLoanLifecycleRecord;
  recentEvents: HeadlessLifecycleEvent[];
}): LifecycleEventIntegrityResult {
  const previous = summarizeLifecycle(input.record);
  const duplicate = findDuplicateEvent(input.event, input.recentEvents);
  if (duplicate) return blocked(input.event, input.record, duplicate.status, duplicate.reason, duplicate.manualReviewRecommended);

  const stale = detectStaleOrOutOfOrder(input.event, input.record, input.recentEvents);
  if (stale) return blocked(input.event, input.record, stale.status, stale.reason, stale.manualReviewRecommended);

  const unsafe = detectUnsafeTransition(input.event, input.record);
  if (unsafe) return blocked(input.event, input.record, unsafe.status, unsafe.reason, unsafe.manualReviewRecommended);

  return {
    eventId: input.event.id,
    lookupCode: input.event.lookupCode,
    status: "accepted",
    applied: true,
    reason: "Lifecycle event accepted for transition.",
    affectedLifecycleSections: [getAffectedLifecycleSection(input.event.kind)],
    previousStatusSummary: previous,
    auditNote: "Event passed duplicate, replay, staleness, and transition-safety checks.",
    manualReviewRecommended: false,
  };
}

export function createIntegrityAuditEvent(input: {
  event: HeadlessLifecycleEvent;
  result: LifecycleEventIntegrityResult;
  createdAt?: string;
}): HeadlessLifecycleEvent {
  const createdAt = input.createdAt ?? new Date().toISOString();
  return {
    id: `integrity-${createdAt.replace(/[^0-9]/g, "").slice(0, 14)}-${input.event.id}`,
    lookupCode: input.event.lookupCode,
    kind: "lifecycle_event_integrity_checked",
    source: "system",
    observedAt: createdAt,
    createdAt,
    externalReference: input.event.id,
    safetyAuditNote: input.result.auditNote,
    payload: {
      detail: input.result.reason,
      integrityStatus: input.result.status,
      integrityApplied: false,
      integrityReason: input.result.reason,
      integrityAuditNote: input.result.auditNote,
      integrityOriginalEventId: input.event.id,
      integrityPreviousSummary: JSON.stringify(input.result.previousStatusSummary),
      integrityManualReviewRecommended: input.result.manualReviewRecommended,
    },
  };
}

export function attachIntegrityResult(event: HeadlessLifecycleEvent, result: LifecycleEventIntegrityResult): HeadlessLifecycleEvent {
  return {
    ...event,
    payload: {
      ...event.payload,
      integrityStatus: result.status,
      integrityApplied: result.applied,
      integrityReason: result.reason,
      integrityAuditNote: result.auditNote,
      integrityPreviousSummary: JSON.stringify(result.previousStatusSummary),
      integrityNextSummary: result.nextStatusSummary ? JSON.stringify(result.nextStatusSummary) : undefined,
      integrityManualReviewRecommended: result.manualReviewRecommended,
    },
  };
}

function findDuplicateEvent(event: HeadlessLifecycleEvent, recentEvents: HeadlessLifecycleEvent[]): { status: LifecycleEventIntegrityStatus; reason: string; manualReviewRecommended: boolean } | null {
  const candidates = recentEvents.filter((existing) => existing.kind !== "lifecycle_event_integrity_checked");
  if (candidates.some((existing) => existing.id === event.id)) return { status: "duplicate", reason: "Duplicate event id; event was not applied again.", manualReviewRecommended: false };
  if (event.externalReference && candidates.some((existing) => existing.externalReference === event.externalReference && existing.kind === event.kind)) {
    return { status: "replayed", reason: "Duplicate external reference for the same lifecycle event kind; replay ignored.", manualReviewRecommended: false };
  }
  if (event.payload.watcherEventId && candidates.some((existing) => existing.payload.watcherEventId === event.payload.watcherEventId)) {
    return { status: "replayed", reason: "Duplicate watcher event id; watcher replay ignored.", manualReviewRecommended: false };
  }
  if (event.payload.healthResultId && candidates.some((existing) => existing.payload.healthResultId === event.payload.healthResultId)) {
    return { status: "replayed", reason: "Duplicate oracle/liquidation health result id; scenario replay ignored.", manualReviewRecommended: false };
  }
  if (event.payload.arbiterDecisionId && candidates.some((existing) => existing.payload.arbiterDecisionId === event.payload.arbiterDecisionId)) {
    return { status: "replayed", reason: "Duplicate arbiter decision id; decision replay ignored.", manualReviewRecommended: false };
  }
  if (event.payload.reviewId && event.kind === "arbiter_review_resolved" && candidates.some((existing) => existing.kind === event.kind && existing.payload.reviewId === event.payload.reviewId)) {
    return { status: "replayed", reason: "Duplicate arbiter resolution for the same review id; replay ignored.", manualReviewRecommended: false };
  }
  if (event.kind === "borrower_quote_accepted" && candidates.some((existing) => existing.kind === "borrower_quote_accepted")) {
    return { status: "replayed", reason: "Borrower quote acceptance was already recorded for this loan.", manualReviewRecommended: false };
  }
  return null;
}

function detectStaleOrOutOfOrder(event: HeadlessLifecycleEvent, record: HeadlessLoanLifecycleRecord, recentEvents: HeadlessLifecycleEvent[]): { status: LifecycleEventIntegrityStatus; reason: string; manualReviewRecommended: boolean } | null {
  const sectionEvents = recentEvents.filter((existing) => existing.kind !== "lifecycle_event_integrity_checked" && getAffectedLifecycleSection(existing.kind) === getAffectedLifecycleSection(event.kind));
  const newestSectionEvent = sectionEvents.sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
  if (newestSectionEvent && event.observedAt < newestSectionEvent.observedAt && !isExplicitReviewOrCorrection(event)) {
    return { status: "out_of_order", reason: `Event observed at ${event.observedAt} is older than latest ${getAffectedLifecycleSection(event.kind)} event ${newestSectionEvent.observedAt}.`, manualReviewRecommended: true };
  }

  if (event.observedAt < record.timestamps.lastUpdatedAt && progressiveEventKinds.has(event.kind) && !isExplicitReviewOrCorrection(event)) {
    return { status: "stale", reason: "Older progressive event cannot overwrite a newer lifecycle record state.", manualReviewRecommended: true };
  }

  if (record.collateralLock.status === "locked" && event.kind === "collateral_lock_observed" && event.payload.collateralVerifierStatus !== "confirmed") {
    return { status: "contradictory", reason: "Non-confirmed collateral observation cannot overwrite an already locked collateral state.", manualReviewRecommended: true };
  }
  if (record.collateralLock.status === "failed" && event.kind === "collateral_lock_observed" && event.payload.collateralVerifierStatus === "confirmed" && event.payload.watcherRiskStatus !== "normal") {
    return { status: "unsafe_transition", reason: "Collateral previously failed and new confirmation still carries stale/reorg risk.", manualReviewRecommended: true };
  }
  if (record.repaymentDetection.status === "detected" && event.kind === "repayment_observed" && event.payload.repaymentVerifierStatus !== "valid_full_repayment") {
    return { status: "contradictory", reason: "Older or partial repayment event cannot reverse an already detected full repayment.", manualReviewRecommended: true };
  }
  if (record.arbiterReview.status === "resolved" && event.kind === "arbiter_review_requested" && !isExplicitReviewOrCorrection(event)) {
    return { status: "out_of_order", reason: "Older arbiter request cannot reopen a resolved review without explicit manual review semantics.", manualReviewRecommended: true };
  }
  return null;
}

function detectUnsafeTransition(event: HeadlessLifecycleEvent, record: HeadlessLoanLifecycleRecord): { status: LifecycleEventIntegrityStatus; reason: string; manualReviewRecommended: boolean } | null {
  if (event.payload.watcherRiskStatus === "stale" || event.payload.watcherRiskStatus === "reorged") {
    if (event.payload.collateralVerifierStatus === "confirmed" || event.payload.platformFeeVerifierStatus === "valid" || event.payload.supplierDisbursementVerifierStatus === "valid" || event.payload.repaymentVerifierStatus?.startsWith("valid_")) {
      return { status: "unsafe_transition", reason: "Stale or reorged watcher event cannot move lifecycle into a safer confirmed state.", manualReviewRecommended: true };
    }
  }
  if (event.kind === "liquidation_review_confirmed" && (record.oracleHealth.oracleUsable === false || record.oracleHealth.oracleFreshnessStatus === "stale" || record.oracleHealth.oracleDeviationStatus === "deviated")) {
    return { status: "unsafe_transition", reason: "Liquidation review confirmation is blocked while oracle data is stale, deviated, or unusable.", manualReviewRecommended: true };
  }
  if (event.kind === "liquidation_review_confirmed" && event.payload.automaticLiquidationBlocked === false) {
    return { status: "unsafe_transition", reason: "Liquidation review events must keep automatic liquidation explicitly blocked.", manualReviewRecommended: true };
  }
  if (event.kind === "supplier_disbursement_observed" && event.payload.supplierDisbursementVerifierStatus && event.payload.supplierDisbursementVerifierStatus !== "valid" && record.supplierDisbursement.status === "disbursed") {
    return { status: "contradictory", reason: "Supplier disbursement mismatch cannot coexist as a safe disbursed state without review.", manualReviewRecommended: true };
  }
  if (event.kind === "dcr_platform_fee_output_observed" && event.payload.platformFeeVerifierStatus && event.payload.platformFeeVerifierStatus !== "valid" && record.dcrPlatformFeeOutput.status === "detected") {
    return { status: "contradictory", reason: "Missing or mismatched platform fee cannot overwrite a detected fee output as safe progression.", manualReviewRecommended: true };
  }
  if (event.kind === "repayment_observed" && event.payload.repaymentVerifierStatus && !event.payload.repaymentVerifierStatus.startsWith("valid_") && record.repaymentDetection.status === "detected") {
    return { status: "contradictory", reason: "Repayment mismatch cannot mark or reverse complete repayment.", manualReviewRecommended: true };
  }
  if (event.kind === "collateral_lock_observed" && event.payload.collateralVerifierStatus === "confirmed" && (event.payload.watcherRiskStatus === "stale" || event.payload.watcherRiskStatus === "reorged")) {
    return { status: "unsafe_transition", reason: "Stale or reorged collateral observation cannot appear safely locked.", manualReviewRecommended: true };
  }
  if (event.kind === "repayment_observed" && !record.supplierPositions.length) {
    return { status: "missing_required_context", reason: "Repayment event requires supplier positions for repayment allocation.", manualReviewRecommended: true };
  }
  return null;
}

function blocked(
  event: HeadlessLifecycleEvent,
  record: HeadlessLoanLifecycleRecord,
  status: LifecycleEventIntegrityStatus,
  reason: string,
  manualReviewRecommended: boolean,
): LifecycleEventIntegrityResult {
  return {
    eventId: event.id,
    lookupCode: event.lookupCode,
    status,
    applied: false,
    reason,
    affectedLifecycleSections: [getAffectedLifecycleSection(event.kind)],
    previousStatusSummary: summarizeLifecycle(record),
    auditNote: `Lifecycle event integrity guard returned ${status}: ${reason}`,
    manualReviewRecommended,
  };
}

const progressiveEventKinds = new Set<HeadlessLifecycleEvent["kind"]>([
  "collateral_lock_observed",
  "dcr_platform_fee_output_observed",
  "supplier_disbursement_observed",
  "repayment_observed",
  "collateral_release_observed",
  "liquidation_health_updated",
  "borrower_warning_opened",
  "top_up_requested",
  "liquidation_review_confirmed",
  "arbiter_review_requested",
  "arbiter_review_resolved",
  "evidence_timestamp_anchored",
  "evidence_timestamp_verified",
]);

function isExplicitReviewOrCorrection(event: HeadlessLifecycleEvent): boolean {
  return event.source === "arbiter" || event.source === "operator" || event.payload.status === "manual_review" || event.payload.detail.toLowerCase().includes("correction");
}
