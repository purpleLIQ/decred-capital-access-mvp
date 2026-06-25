import { getAffectedLifecycleSection, type HeadlessLifecycleEvent, type LifecycleEventIntegrityStatus } from "./headless-lifecycle-events";
import type { HeadlessLoanLifecycleRecord } from "./headless-loan-lifecycle";
import type { HeadlessLifecycleEventStore } from "./lifecycle-event-store";

export interface LifecycleEventIntegrityResult {
  eventId: string;
  lookupCode: string;
  status: LifecycleEventIntegrityStatus;
  applied: boolean;
  reason: string;
  auditNote: string;
  affectedLifecycleSections?: string[];
  previousStatusSummary?: string;
  nextStatusSummary?: string;
  manualReviewRecommended?: boolean;
  matchingEventId?: string;
  recommendation?: string;
}

export async function validateLifecycleEventIntegrity(input: {
  event: HeadlessLifecycleEvent;
  record: HeadlessLoanLifecycleRecord;
  eventStore: HeadlessLifecycleEventStore;
}): Promise<LifecycleEventIntegrityResult> {
  const eventIdMatch = await findByEventId(input.eventStore, input.event.id);
  if (eventIdMatch) {
    return blocked(input, "duplicate", `Event id ${input.event.id} was already stored.`, {
      matchingEventId: eventIdMatch.id,
      recommendation: "Do not re-apply an event with the same deterministic id.",
    });
  }

  const replayedEvent = await findReplayMatch(input.eventStore, input.event);
  if (replayedEvent) {
    return blocked(input, "replayed", "A prior event with the same replay-sensitive reference was already stored for this event kind.", {
      matchingEventId: replayedEvent.id,
      recommendation: "Treat this as a no-op unless an operator intentionally creates a corrected event with new evidence.",
    });
  }

  const unsafe = unsafeTransitionReason(input.record, input.event);
  if (unsafe) {
    return blocked(input, unsafe.status, unsafe.reason, {
      manualReviewRecommended: true,
      recommendation: unsafe.recommendation,
    });
  }

  return {
    eventId: input.event.id,
    lookupCode: input.event.lookupCode,
    status: "accepted",
    applied: true,
    reason: "Lifecycle event passed integrity checks and can be applied.",
    auditNote: "Integrity gate accepted this lifecycle event before mutation. No keys, signing, broadcast, liquidation execution, or funds movement occurred.",
    affectedLifecycleSections: [getAffectedLifecycleSection(input.event.kind)],
    previousStatusSummary: previousStatusSummary(input.record, input.event),
    nextStatusSummary: nextStatusSummary(input.event),
    manualReviewRecommended: false,
  };
}

export function attachIntegrityResultToEvent(event: HeadlessLifecycleEvent, integrity: LifecycleEventIntegrityResult): HeadlessLifecycleEvent {
  return {
    ...event,
    payload: {
      ...event.payload,
      integrityStatus: integrity.status,
      integrityApplied: integrity.applied,
      integrityReason: integrity.reason,
      integrityAuditNote: integrity.auditNote,
      integrityOriginalEventId: integrity.matchingEventId,
      integrityAffectedSections: integrity.affectedLifecycleSections,
      integrityManualReviewRecommended: integrity.manualReviewRecommended,
    },
    safetyAuditNote: `${event.safetyAuditNote} Integrity: ${integrity.status}; applied ${integrity.applied}.`,
  };
}

function blocked(
  input: { event: HeadlessLifecycleEvent; record: HeadlessLoanLifecycleRecord },
  status: Exclude<LifecycleEventIntegrityStatus, "accepted">,
  reason: string,
  options: {
    matchingEventId?: string;
    manualReviewRecommended?: boolean;
    recommendation?: string;
  } = {},
): LifecycleEventIntegrityResult {
  return {
    eventId: input.event.id,
    lookupCode: input.event.lookupCode,
    status,
    applied: false,
    reason,
    auditNote: "Integrity gate blocked this lifecycle event before mutation. The event is review/no-op metadata only and does not sign, broadcast, liquidate, or move funds.",
    affectedLifecycleSections: [getAffectedLifecycleSection(input.event.kind)],
    previousStatusSummary: previousStatusSummary(input.record, input.event),
    nextStatusSummary: nextStatusSummary(input.event),
    manualReviewRecommended: options.manualReviewRecommended ?? shouldRecommendManualReview(status),
    matchingEventId: options.matchingEventId,
    recommendation: options.recommendation ?? "Review the event history and submit a corrected event only if newer evidence supports it.",
  };
}

async function findReplayMatch(eventStore: HeadlessLifecycleEventStore, event: HeadlessLifecycleEvent): Promise<HeadlessLifecycleEvent | null> {
  if (event.payload.watcherEventId) {
    const match = await findByPayloadField(eventStore, event.lookupCode, "watcherEventId", event.payload.watcherEventId);
    if (sameReplayKind(match, event)) return match;
  }

  if (event.payload.healthResultId) {
    const match = await findByPayloadField(eventStore, event.lookupCode, "healthResultId", event.payload.healthResultId);
    if (sameReplayKind(match, event)) return match;
  }

  if (event.payload.arbiterDecisionId) {
    const match = await findByPayloadField(eventStore, event.lookupCode, "arbiterDecisionId", event.payload.arbiterDecisionId);
    if (sameReplayKind(match, event)) return match;
  }

  if (event.externalReference) {
    const match = await findByExternalReference(eventStore, event.lookupCode, event.externalReference);
    if (sameReplayKind(match, event)) return match;
  }

  return null;
}

function sameReplayKind(match: HeadlessLifecycleEvent | null, event: HeadlessLifecycleEvent): match is HeadlessLifecycleEvent {
  return Boolean(match && match.kind === event.kind && match.id !== event.id && match.payload.integrityApplied !== false);
}

function unsafeTransitionReason(
  record: HeadlessLoanLifecycleRecord,
  event: HeadlessLifecycleEvent,
): { status: Exclude<LifecycleEventIntegrityStatus, "accepted" | "duplicate" | "replayed">; reason: string; recommendation?: string } | null {
  if (event.kind === "repayment_observed" && record.repaymentDetection.status === "detected" && isOlderOrEqual(event.observedAt, record.repaymentDetection.updatedAt)) {
    return {
      status: "out_of_order",
      reason: "Older repayment event cannot roll back an already detected full repayment.",
      recommendation: "Keep the full repayment state and treat the older repayment event as no-op evidence.",
    };
  }

  if (isWatcherEvent(event) && isEventStaleForSection(record, event)) {
    return {
      status: "stale",
      reason: "Watcher event is older than the stored lifecycle section it would update.",
      recommendation: "Keep the newer lifecycle state and review the older watcher observation as no-op evidence.",
    };
  }

  if (hasUnsafeWatcherRisk(event) && isEventStaleForSection(record, event)) {
    return {
      status: "stale",
      reason: "Stale/reorg-risk watcher event cannot overwrite newer lifecycle state.",
      recommendation: "Open or keep manual review instead of reverting the lifecycle section.",
    };
  }

  if (event.kind === "repayment_observed" && invalidRepaymentVerifier(event)) {
    return {
      status: "contradictory",
      reason: "Repayment watcher reported a mismatch or missing repayment, so the event cannot complete repayment.",
      recommendation: "Keep repayment state unchanged and route the mismatch to arbiter/operator review.",
    };
  }

  if (isOracleHealthEvent(event) && isOlderOrEqual(event.observedAt, record.oracleHealth.updatedAt) && healthRank(nextHealthStatus(event)) < healthRank(record.oracleHealth.status)) {
    return {
      status: "stale",
      reason: "Older oracle/liquidation health result cannot make the loan appear safer than the current health state.",
      recommendation: "Keep the newer riskier state and submit a fresh oracle health result if conditions improve.",
    };
  }

  if (event.kind === "arbiter_review_requested" && record.arbiterReview.status === "resolved" && isOlderOrEqual(event.observedAt, record.arbiterReview.updatedAt)) {
    return {
      status: "out_of_order",
      reason: "Older arbiter review request cannot reopen a resolved arbiter case.",
      recommendation: "Submit a new manual review event only if fresh evidence creates a new case.",
    };
  }

  if (event.kind === "liquidation_review_confirmed" && (event.payload.automaticLiquidationBlocked === false || event.payload.health === "auto_liquidation_pending" || event.payload.status === "auto_liquidation_pending")) {
    return {
      status: "unsafe_transition",
      reason: "Liquidation review events cannot imply liquidation execution readiness.",
      recommendation: "Keep liquidation review as review-only until separate simnet/testnet, legal, security, signing, and broadcast gates exist.",
    };
  }

  return null;
}

async function findByEventId(eventStore: HeadlessLifecycleEventStore, eventId: string): Promise<HeadlessLifecycleEvent | null> {
  if (eventStore.findByEventId) return eventStore.findByEventId(eventId);
  const recent = await eventStore.listRecent(100);
  return recent.find((event) => event.id === eventId) ?? null;
}

async function findByExternalReference(eventStore: HeadlessLifecycleEventStore, lookupCode: string, externalReference: string): Promise<HeadlessLifecycleEvent | null> {
  if (eventStore.findByExternalReference) return eventStore.findByExternalReference(lookupCode, externalReference);
  const events = await eventStore.listByLookupCode(lookupCode, 100);
  return events.find((event) => event.externalReference === externalReference) ?? null;
}

async function findByPayloadField(
  eventStore: HeadlessLifecycleEventStore,
  lookupCode: string,
  field: "watcherEventId" | "healthResultId" | "arbiterDecisionId",
  value: string,
): Promise<HeadlessLifecycleEvent | null> {
  if (field === "watcherEventId" && eventStore.findByWatcherEventId) return eventStore.findByWatcherEventId(lookupCode, value);
  if (field === "healthResultId" && eventStore.findByHealthResultId) return eventStore.findByHealthResultId(lookupCode, value);
  if (field === "arbiterDecisionId" && eventStore.findByArbiterDecisionId) return eventStore.findByArbiterDecisionId(lookupCode, value);
  const events = await eventStore.listByLookupCode(lookupCode, 100);
  return events.find((event) => event.payload[field] === value) ?? null;
}

function isWatcherEvent(event: HeadlessLifecycleEvent): boolean {
  return event.source === "watcher" || Boolean(event.payload.watcherEventId || event.payload.decredWatcherKind || event.payload.borrowAssetWatcherKind);
}

function isOracleHealthEvent(event: HeadlessLifecycleEvent): boolean {
  return event.kind === "oracle_price_observed" || event.kind === "liquidation_health_updated" || event.kind === "borrower_warning_opened" || event.kind === "top_up_requested" || event.kind === "liquidation_review_confirmed";
}

function isEventStaleForSection(record: HeadlessLoanLifecycleRecord, event: HeadlessLifecycleEvent): boolean {
  const updatedAt = sectionUpdatedAt(record, event);
  return Boolean(updatedAt && sectionHasProgressed(record, event) && isOlderOrEqual(event.observedAt, updatedAt));
}

function sectionUpdatedAt(record: HeadlessLoanLifecycleRecord, event: HeadlessLifecycleEvent): string | undefined {
  switch (getAffectedLifecycleSection(event.kind)) {
    case "collateralLock":
      return record.collateralLock.updatedAt;
    case "dcrPlatformFeeOutput":
      return record.dcrPlatformFeeOutput.updatedAt;
    case "supplierDisbursement":
      return record.supplierDisbursement.updatedAt;
    case "repaymentDetection":
      return record.repaymentDetection.updatedAt;
    case "collateralRelease":
      return record.collateralRelease.updatedAt;
    case "liquidationHealth":
      return record.liquidationHealth.updatedAt;
    case "arbiterReview":
      return record.arbiterReview.updatedAt;
    case "evidenceBundle":
      return record.evidenceBundle.updatedAt;
    case "quoteStatus":
    case "borrowerContact":
      return record.timestamps.lastUpdatedAt;
  }
}

function sectionHasProgressed(record: HeadlessLoanLifecycleRecord, event: HeadlessLifecycleEvent): boolean {
  switch (getAffectedLifecycleSection(event.kind)) {
    case "collateralLock":
      return record.collateralLock.status === "locked" || record.collateralLock.status === "failed";
    case "dcrPlatformFeeOutput":
      return record.dcrPlatformFeeOutput.status === "detected" || record.dcrPlatformFeeOutput.status === "routed" || record.dcrPlatformFeeOutput.status === "not_started";
    case "supplierDisbursement":
      return record.supplierDisbursement.status === "disbursed";
    case "repaymentDetection":
      return record.repaymentDetection.status === "partial" || record.repaymentDetection.status === "detected";
    case "collateralRelease":
      return record.collateralRelease.status === "ready" || record.collateralRelease.status === "released";
    case "liquidationHealth":
      return record.liquidationHealth.status !== "healthy" || record.oracleHealth.status !== "healthy";
    case "arbiterReview":
      return record.arbiterReview.status === "requested" || record.arbiterReview.status === "resolved";
    case "evidenceBundle":
      return record.evidenceBundle.status !== "placeholder" || record.evidenceBundle.timestamp.status !== "not_prepared";
    case "quoteStatus":
    case "borrowerContact":
      return true;
  }
}

function hasUnsafeWatcherRisk(event: HeadlessLifecycleEvent): boolean {
  const risk = event.payload.watcherRiskStatus;
  return risk === "stale" || risk === "reorged" || risk === "reorg_risk" || risk === "unfinalized";
}

function invalidRepaymentVerifier(event: HeadlessLifecycleEvent): boolean {
  const status = event.payload.repaymentVerifierStatus;
  return status === "missing" || status === "amount_mismatch" || status === "destination_mismatch" || status === "asset_mismatch" || status === "token_contract_mismatch" || status === "unconfirmed" || status === "stale" || status === "reorged";
}

function nextHealthStatus(event: HeadlessLifecycleEvent): HeadlessLoanLifecycleRecord["oracleHealth"]["status"] {
  const status = event.payload.health ?? event.payload.status;
  if (
    status === "healthy" ||
    status === "watch" ||
    status === "warning" ||
    status === "margin_call" ||
    status === "liquidation_eligible" ||
    status === "arbiter_window_open" ||
    status === "auto_liquidation_pending" ||
    status === "resolved" ||
    status === "blocked" ||
    status === "liquidation_review"
  ) {
    return status;
  }
  return "healthy";
}

function healthRank(status: HeadlessLoanLifecycleRecord["oracleHealth"]["status"]): number {
  switch (status) {
    case "healthy":
    case "resolved":
      return 0;
    case "watch":
      return 1;
    case "warning":
      return 2;
    case "margin_call":
      return 3;
    case "liquidation_eligible":
    case "arbiter_window_open":
    case "liquidation_review":
      return 4;
    case "blocked":
      return 5;
    case "auto_liquidation_pending":
      return 6;
  }
}

function isOlderOrEqual(left: string, right: string | undefined): boolean {
  return Boolean(right && Date.parse(left) <= Date.parse(right));
}

function previousStatusSummary(record: HeadlessLoanLifecycleRecord, event: HeadlessLifecycleEvent): string {
  switch (getAffectedLifecycleSection(event.kind)) {
    case "collateralLock":
      return `collateralLock:${record.collateralLock.status}`;
    case "dcrPlatformFeeOutput":
      return `dcrPlatformFeeOutput:${record.dcrPlatformFeeOutput.status}`;
    case "supplierDisbursement":
      return `supplierDisbursement:${record.supplierDisbursement.status}`;
    case "repaymentDetection":
      return `repaymentDetection:${record.repaymentDetection.status}`;
    case "collateralRelease":
      return `collateralRelease:${record.collateralRelease.status}`;
    case "liquidationHealth":
      return `liquidationHealth:${record.liquidationHealth.status}; oracleHealth:${record.oracleHealth.status}`;
    case "arbiterReview":
      return `arbiterReview:${record.arbiterReview.status}`;
    case "evidenceBundle":
      return `evidenceBundle:${record.evidenceBundle.status}; timestamp:${record.evidenceBundle.timestamp.status}`;
    case "quoteStatus":
      return `quoteStatus:${record.quoteStatus}`;
    case "borrowerContact":
      return `borrowerContact:${record.borrowerContact.preference}`;
  }
}

function nextStatusSummary(event: HeadlessLifecycleEvent): string {
  const status = event.payload.status ?? event.payload.health ?? event.payload.repaymentVerifierStatus ?? event.payload.collateralVerifierStatus ?? event.payload.platformFeeVerifierStatus ?? event.payload.supplierDisbursementVerifierStatus ?? "unspecified";
  return `${event.kind}:${status}`;
}

function shouldRecommendManualReview(status: LifecycleEventIntegrityStatus): boolean {
  return status !== "duplicate" && status !== "replayed";
}
