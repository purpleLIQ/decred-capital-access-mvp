import type { HeadlessLifecycleEvent } from "./headless-lifecycle-events";
import type { HeadlessLoanLifecycleRecord } from "./headless-loan-lifecycle";

export type ArbiterCaseType =
  | "collateral_issue"
  | "platform_fee_issue"
  | "supplier_disbursement_issue"
  | "repayment_dispute"
  | "liquidation_health_review"
  | "evidence_incomplete"
  | "watcher_stale_or_reorged"
  | "manual_review";

export type ArbiterCaseStatus = "queued" | "evidence_needed" | "under_review" | "action_required" | "resolved" | "closed" | "blocked";
export type ArbiterCasePriority = "low" | "medium" | "high" | "urgent";

export type ArbiterActionKind =
  | "request_more_evidence"
  | "recognize_repayment"
  | "recognize_top_up"
  | "pause_liquidation"
  | "mark_dispute"
  | "resolve_case"
  | "confirm_liquidation_review";

export interface ArbiterAllowedAction {
  actionId: string;
  caseId: string;
  kind: ArbiterActionKind;
  label: string;
  description: string;
  allowed: boolean;
  blockerReason?: string;
  requiredEvidenceSummary: string;
  safetyNote: string;
}

export interface ArbiterActionDecision {
  decisionId: string;
  caseId: string;
  actionKind: ArbiterActionKind;
  decidedAt: string;
  decidedBy: string;
  status: "recorded" | "blocked";
  note: string;
  lifecycleEvent?: HeadlessLifecycleEvent;
  safetyNote: string;
}

export interface ArbiterReviewCase {
  caseId: string;
  lookupCode: string;
  caseType: ArbiterCaseType;
  status: ArbiterCaseStatus;
  priority: ArbiterCasePriority;
  reason: string;
  relatedLifecycleStatus: HeadlessLoanLifecycleRecord["lifecycleStatus"];
  relatedLifecycleEventIds: string[];
  relatedWatcherEventIds: string[];
  relatedEvidenceBundleId?: string;
  relatedEvidenceHash?: string;
  evidenceTimestampStatus?: HeadlessLoanLifecycleRecord["evidenceBundle"]["timestamp"]["status"];
  borrowerSafeSummary: string;
  arbiterInternalSummary: string;
  openedAt: string;
  updatedAt: string;
  reviewDeadlineAt?: string;
  assignedArbiter?: string;
  allowedActions: ArbiterAllowedAction[];
  decisions: ArbiterActionDecision[];
  safetyAuditNote: string;
}

export interface ArbiterCaseDerivationInput {
  record: HeadlessLoanLifecycleRecord;
  recentEvents?: HeadlessLifecycleEvent[];
  manualReviewReason?: string;
  now?: string;
}

const DEFAULT_REVIEW_WINDOW_HOURS = 48;

export function deriveArbiterReviewCases(input: ArbiterCaseDerivationInput): ArbiterReviewCase[] {
  const record = input.record;
  const events = input.recentEvents ?? [];
  const now = input.now ?? new Date().toISOString();
  const cases: ArbiterReviewCase[] = [];

  if (record.dcrPlatformFeeOutput.status === "not_started" && hasEvent(events, "platformFeeVerifierStatus", ["missing", "amount_mismatch", "destination_mismatch", "stale", "reorged"])) {
    cases.push(createCase({ record, events, now, caseType: "platform_fee_issue", priority: "high", reason: "DCR platform fee output requires review.", borrowerSafeSummary: "Platform fee review is in progress.", arbiterInternalSummary: "Platform fee watcher reported a missing, mismatched, stale, or reorged output." }));
  }

  if (record.collateralLock.status === "failed" || hasEvent(events, "collateralVerifierStatus", ["amount_mismatch", "destination_mismatch", "stale", "reorged", "missing"])) {
    cases.push(createCase({ record, events, now, caseType: "collateral_issue", priority: "high", reason: "Collateral lock observation requires review.", borrowerSafeSummary: "Collateral review is in progress.", arbiterInternalSummary: "Collateral watcher reported a mismatch, stale state, reorg, or missing output." }));
  }

  if (hasEvent(events, "supplierDisbursementVerifierStatus", ["missing", "amount_mismatch", "destination_mismatch", "asset_mismatch", "token_contract_mismatch", "stale", "reorged"])) {
    cases.push(createCase({ record, events, now, caseType: "supplier_disbursement_issue", priority: "high", reason: "Supplier disbursement observation requires review.", borrowerSafeSummary: "Supplier disbursement review is in progress.", arbiterInternalSummary: "Borrow-asset watcher reported a supplier disbursement issue." }));
  }

  if (hasEvent(events, "repaymentVerifierStatus", ["missing", "amount_mismatch", "destination_mismatch", "asset_mismatch", "token_contract_mismatch", "stale", "reorged"])) {
    cases.push(createCase({ record, events, now, caseType: "repayment_dispute", priority: "high", reason: "Repayment observation requires review.", borrowerSafeSummary: "Repayment review is in progress.", arbiterInternalSummary: "Borrow-asset watcher reported a repayment mismatch, stale state, or reorg." }));
  }

  if (record.repaymentDetection.status === "detected" && record.evidenceBundle.status === "placeholder") {
    cases.push(createCase({ record, events, now, caseType: "evidence_incomplete", priority: "medium", reason: "Repayment is observed but evidence bundle is not prepared.", borrowerSafeSummary: "Repayment evidence review is in progress.", arbiterInternalSummary: "Repayment was detected before a prepared evidence bundle exists." }));
  }

  if (record.liquidationHealth.status === "warning" || record.liquidationHealth.status === "liquidation_review") {
    cases.push(createCase({ record, events, now, caseType: "liquidation_health_review", priority: record.liquidationHealth.status === "liquidation_review" ? "urgent" : "high", reason: "Loan health requires arbiter review.", borrowerSafeSummary: "Loan health review is open.", arbiterInternalSummary: "Liquidation health moved into warning or review state. This is review-only and not execution." }));
  }

  if (record.evidenceBundle.timestamp.status === "failed") {
    cases.push(createCase({ record, events, now, caseType: "evidence_incomplete", priority: "medium", reason: "Evidence timestamp state requires review.", borrowerSafeSummary: "Evidence review is in progress.", arbiterInternalSummary: "Evidence timestamp anchoring failed and may need retry or more evidence." }));
  }

  if (hasWatcherRisk(events, ["stale", "reorged", "reorg_risk", "unfinalized"])) {
    cases.push(createCase({ record, events, now, caseType: "watcher_stale_or_reorged", priority: "high", reason: "Watcher state requires review.", borrowerSafeSummary: "Watcher review is in progress.", arbiterInternalSummary: "Recent lifecycle events include stale, unfinalized, reorg-risk, or reorged watcher state." }));
  }

  if (input.manualReviewReason) {
    cases.push(createCase({ record, events, now, caseType: "manual_review", priority: "medium", reason: input.manualReviewReason, borrowerSafeSummary: "Manual review is open.", arbiterInternalSummary: input.manualReviewReason }));
  }

  return dedupeCases(cases);
}

export function createAllowedArbiterActions(input: {
  caseId: string;
  caseType: ArbiterCaseType;
  status: ArbiterCaseStatus;
  evidenceReady: boolean;
  repaymentObserved: boolean;
  liquidationReview: boolean;
}): ArbiterAllowedAction[] {
  const base = (kind: ArbiterActionKind, label: string, description: string, allowed: boolean, blockerReason?: string): ArbiterAllowedAction => ({
    actionId: `${input.caseId}-${kind}`,
    caseId: input.caseId,
    kind,
    label,
    description,
    allowed,
    blockerReason,
    requiredEvidenceSummary: input.evidenceReady ? "Evidence bundle or timestamp metadata is available for review." : "Evidence bundle or timestamp metadata is not complete yet.",
    safetyNote: kind === "confirm_liquidation_review"
      ? "This records review eligibility only. It does not create, sign, broadcast, or execute a liquidation transaction."
      : "This records an arbiter review decision only. No signing, broadcast, or funds movement occurs.",
  });

  const open = input.status !== "resolved" && input.status !== "closed";
  return [
    base("request_more_evidence", "Request more evidence", "Ask operators or participants for additional evidence before a decision.", open),
    base("recognize_repayment", "Recognize repayment", "Record that repayment evidence should be recognized through the lifecycle event path.", open && input.repaymentObserved, input.repaymentObserved ? undefined : "No valid repayment observation is available."),
    base("recognize_top_up", "Recognize top-up", "Record that collateral top-up evidence should be recognized later.", false, "Top-up watcher support is not implemented yet."),
    base("pause_liquidation", "Pause review path", "Pause any later reviewed liquidation path while evidence is incomplete.", open && (input.caseType === "liquidation_health_review" || input.caseType === "watcher_stale_or_reorged")),
    base("mark_dispute", "Mark dispute", "Mark the case as disputed for further review.", open),
    base("resolve_case", "Resolve case", "Close the review case after evidence has been reviewed.", open && input.evidenceReady, input.evidenceReady ? undefined : "Evidence is not complete enough to resolve."),
    base("confirm_liquidation_review", "Confirm liquidation review", "Record that this case may move to a later separately gated transaction review.", open && input.liquidationReview && input.evidenceReady, input.liquidationReview ? (input.evidenceReady ? undefined : "Evidence must be complete before confirming review.") : "Case is not a loan-health review."),
  ];
}

export function createArbiterCaseId(lookupCode: string, caseType: ArbiterCaseType): string {
  const compactLookup = lookupCode.replace(/[^a-zA-Z0-9]/g, "").slice(-12).toLowerCase();
  return `arb-${compactLookup}-${caseType}`;
}

function createCase(input: {
  record: HeadlessLoanLifecycleRecord;
  events: HeadlessLifecycleEvent[];
  now: string;
  caseType: ArbiterCaseType;
  priority: ArbiterCasePriority;
  reason: string;
  borrowerSafeSummary: string;
  arbiterInternalSummary: string;
}): ArbiterReviewCase {
  const evidenceReady = input.record.evidenceBundle.status !== "placeholder" || input.record.evidenceBundle.timestamp.status === "verified" || input.record.evidenceBundle.timestamp.status === "anchored";
  const repaymentObserved = input.record.repaymentDetection.status === "detected" || input.record.repaymentDetection.status === "partial" || hasEvent(input.events, "repaymentVerifierStatus", ["valid_full_repayment", "valid_partial_repayment"]);
  const liquidationReview = input.caseType === "liquidation_health_review";
  const caseId = createArbiterCaseId(input.record.lookupCode, input.caseType);
  const status: ArbiterCaseStatus = evidenceReady ? "queued" : "evidence_needed";

  return {
    caseId,
    lookupCode: input.record.lookupCode,
    caseType: input.caseType,
    status,
    priority: input.priority,
    reason: input.reason,
    relatedLifecycleStatus: input.record.lifecycleStatus,
    relatedLifecycleEventIds: input.events.map((event) => event.id),
    relatedWatcherEventIds: input.events.map((event) => event.payload.watcherEventId).filter(Boolean) as string[],
    relatedEvidenceBundleId: input.record.evidenceBundle.bundleId,
    relatedEvidenceHash: input.record.evidenceBundle.timestamp.evidenceHash || undefined,
    evidenceTimestampStatus: input.record.evidenceBundle.timestamp.status,
    borrowerSafeSummary: input.borrowerSafeSummary,
    arbiterInternalSummary: input.arbiterInternalSummary,
    openedAt: input.now,
    updatedAt: input.now,
    reviewDeadlineAt: addHours(input.now, DEFAULT_REVIEW_WINDOW_HOURS),
    assignedArbiter: "arbiter-unassigned",
    allowedActions: createAllowedArbiterActions({ caseId, caseType: input.caseType, status, evidenceReady, repaymentObserved, liquidationReview }),
    decisions: [],
    safetyAuditNote: "Arbiter case is review scaffolding only. It does not execute liquidation, sign transactions, broadcast transactions, or move funds.",
  };
}

function hasEvent(events: HeadlessLifecycleEvent[], field: keyof HeadlessLifecycleEvent["payload"], values: string[]): boolean {
  return events.some((event) => {
    const value = event.payload[field];
    return typeof value === "string" && values.includes(value);
  });
}

function hasWatcherRisk(events: HeadlessLifecycleEvent[], values: string[]): boolean {
  return events.some((event) => typeof event.payload.watcherRiskStatus === "string" && values.includes(event.payload.watcherRiskStatus));
}

function dedupeCases(cases: ArbiterReviewCase[]): ArbiterReviewCase[] {
  const seen = new Set<string>();
  return cases.filter((reviewCase) => {
    if (seen.has(reviewCase.caseId)) return false;
    seen.add(reviewCase.caseId);
    return true;
  });
}

function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
}
