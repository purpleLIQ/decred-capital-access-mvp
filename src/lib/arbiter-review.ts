import type { HeadlessLoanLifecycleRecord } from "./headless-loan-lifecycle";
import type { HeadlessLifecycleEvent } from "./headless-lifecycle-events";

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

export type ArbiterActionType =
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
  action: ArbiterActionType;
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
  action: ArbiterActionType;
  decidedAt: string;
  actor: "arbiter" | "operator" | "system" | "fixture";
  note: string;
  lifecycleEvent?: HeadlessLifecycleEvent;
  safetyAuditNote: string;
}

export interface ArbiterReviewCase {
  caseId: string;
  lookupCode: string;
  publicLoanReference: string;
  caseType: ArbiterCaseType;
  status: ArbiterCaseStatus;
  priority: ArbiterCasePriority;
  reason: string;
  relatedLifecycleStatus: HeadlessLoanLifecycleRecord["lifecycleStatus"];
  relatedLifecycleEventIds: string[];
  relatedWatcherEventIds: string[];
  relatedEvidenceBundleId?: string;
  relatedEvidenceHash?: string;
  evidenceTimestampStatus?: string;
  borrowerSafeSummary: string;
  arbiterInternalSummary: string;
  openedAt: string;
  updatedAt: string;
  reviewDeadlineAt: string;
  assignedArbiter: string;
  allowedActions: ArbiterAllowedAction[];
  decisions: ArbiterActionDecision[];
  safetyAuditNote: string;
}

export interface ArbiterCaseDerivationInput {
  lifecycle: HeadlessLoanLifecycleRecord;
  events?: HeadlessLifecycleEvent[];
  manualReviewReason?: string;
  now?: string;
}

const DEFAULT_REVIEW_WINDOW_HOURS = 48;

export function deriveArbiterReviewCases(input: ArbiterCaseDerivationInput): ArbiterReviewCase[] {
  const now = input.now ?? new Date().toISOString();
  const events = input.events ?? [];
  const cases: ArbiterReviewCase[] = [];

  if (input.lifecycle.dcrPlatformFeeOutput.status === "not_started" && hasAnyEvent(events, ["platformFeeVerifierStatus"])) {
    cases.push(createCase({ input, now, caseType: "platform_fee_issue", priority: "high", reason: "DCR platform fee output needs review.", borrowerSafeSummary: "Platform fee review is in progress.", eventFilter: isPlatformFeeIssue }));
  }

  if (input.lifecycle.collateralLock.status === "failed") {
    cases.push(createCase({ input, now, caseType: "collateral_issue", priority: "high", reason: "Collateral watcher status needs review.", borrowerSafeSummary: "Collateral review is in progress.", eventFilter: isCollateralIssue }));
  }

  if (input.lifecycle.supplierDisbursement.status !== "disbursed" && hasAnyEvent(events, ["supplierDisbursementVerifierStatus"])) {
    cases.push(createCase({ input, now, caseType: "supplier_disbursement_issue", priority: "high", reason: "Supplier disbursement watcher status needs review.", borrowerSafeSummary: "Supplier disbursement review is in progress.", eventFilter: isDisbursementIssue }));
  }

  if (hasAnyEvent(events, ["repaymentVerifierStatus"]) && input.lifecycle.repaymentDetection.status !== "detected") {
    cases.push(createCase({ input, now, caseType: "repayment_dispute", priority: "medium", reason: "Repayment watcher status or allocation requires review.", borrowerSafeSummary: "Repayment review is in progress.", eventFilter: isRepaymentIssue }));
  }

  if (input.lifecycle.liquidationHealth.status === "warning" || input.lifecycle.liquidationHealth.status === "liquidation_review") {
    cases.push(createCase({ input, now, caseType: "liquidation_health_review", priority: input.lifecycle.liquidationHealth.status === "liquidation_review" ? "urgent" : "high", reason: "Loan health requires arbiter review before any later reviewed transaction flow.", borrowerSafeSummary: "Loan health review is open.", eventFilter: (event) => event.kind === "liquidation_health_updated" }));
  }

  if (input.lifecycle.evidenceBundle.status === "placeholder" || input.lifecycle.evidenceBundle.timestamp.status === "failed") {
    cases.push(createCase({ input, now, caseType: "evidence_incomplete", priority: "medium", reason: "Evidence bundle or timestamp status needs review.", borrowerSafeSummary: "Evidence review is in progress.", eventFilter: (event) => event.kind.includes("evidence") }));
  }

  if (events.some((event) => event.payload.watcherRiskStatus === "stale" || event.payload.watcherRiskStatus === "reorged")) {
    cases.push(createCase({ input, now, caseType: "watcher_stale_or_reorged", priority: "high", reason: "Watcher stale or reorged state requires review.", borrowerSafeSummary: "Watcher review is in progress.", eventFilter: (event) => event.payload.watcherRiskStatus === "stale" || event.payload.watcherRiskStatus === "reorged" }));
  }

  if (input.manualReviewReason) {
    cases.push(createCase({ input, now, caseType: "manual_review", priority: "medium", reason: input.manualReviewReason, borrowerSafeSummary: "Manual review is open.", eventFilter: () => false }));
  }

  return dedupeCases(cases);
}

export function buildAllowedArbiterActions(reviewCase: Pick<ArbiterReviewCase, "caseId" | "caseType" | "status" | "relatedEvidenceBundleId" | "relatedEvidenceHash">): ArbiterAllowedAction[] {
  const evidenceReady = Boolean(reviewCase.relatedEvidenceBundleId || reviewCase.relatedEvidenceHash);
  const closed = reviewCase.status === "resolved" || reviewCase.status === "closed";
  const base: Array<[ArbiterActionType, string, string]> = [
    ["request_more_evidence", "Request evidence", "Ask operators or participants for more evidence."],
    ["recognize_repayment", "Recognize repayment", "Record that repayment evidence should update the lifecycle."],
    ["recognize_top_up", "Recognize top-up", "Record that collateral top-up evidence was reviewed."],
    ["pause_liquidation", "Pause review path", "Pause any later reviewed risk path while evidence is incomplete."],
    ["mark_dispute", "Mark dispute", "Mark the case as disputed and needing review."],
    ["resolve_case", "Resolve case", "Close the case after review."],
    ["confirm_liquidation_review", "Confirm review eligibility", "Mark review as eligible for a later separately gated transaction flow. This does not execute anything."],
  ];

  return base.map(([action, label, description]) => {
    const needsEvidence = action === "confirm_liquidation_review" || action === "recognize_repayment" || action === "recognize_top_up";
    const allowed = !closed && (!needsEvidence || evidenceReady) && actionAllowedForCase(action, reviewCase.caseType);
    return {
      actionId: `act-${reviewCase.caseId}-${action}`,
      caseId: reviewCase.caseId,
      action,
      label,
      description,
      allowed,
      blockerReason: allowed ? undefined : closed ? "Case is already closed." : needsEvidence && !evidenceReady ? "Audit-safe evidence reference is required." : "Action is not relevant for this case type.",
      requiredEvidenceSummary: needsEvidence ? "Evidence bundle id/hash or reviewed repayment/top-up evidence." : "Case reason and supporting lifecycle events.",
      safetyNote: "Review action only. No signing, broadcast, fund movement, payout, or production execution occurs.",
    };
  });
}

export function createArbiterLifecycleEvent(input: {
  reviewCase: ArbiterReviewCase;
  action?: ArbiterActionType;
  note?: string;
  now?: string;
}): HeadlessLifecycleEvent {
  const now = input.now ?? new Date().toISOString();
  const resolved = input.action === "resolve_case" || input.action === "confirm_liquidation_review";
  return {
    id: `evt-${now.replace(/[^0-9]/g, "").slice(0, 14)}-${input.reviewCase.caseId}-${resolved ? "arbiter_review_resolved" : "arbiter_review_requested"}`,
    lookupCode: input.reviewCase.lookupCode,
    kind: resolved ? "arbiter_review_resolved" : "arbiter_review_requested",
    source: "arbiter",
    observedAt: now,
    createdAt: now,
    externalReference: input.reviewCase.caseId,
    safetyAuditNote: "Arbiter review lifecycle event only. No signing, broadcast, funds movement, or production execution occurred.",
    payload: {
      detail: input.note ?? `${input.reviewCase.caseType} ${resolved ? "review resolved" : "review requested"}: ${input.reviewCase.reason}`,
      reviewId: input.reviewCase.caseId,
    },
  };
}

function createCase(input: {
  input: ArbiterCaseDerivationInput;
  now: string;
  caseType: ArbiterCaseType;
  priority: ArbiterCasePriority;
  reason: string;
  borrowerSafeSummary: string;
  eventFilter: (event: HeadlessLifecycleEvent) => boolean;
}): ArbiterReviewCase {
  const matchedEvents = (input.input.events ?? []).filter(input.eventFilter);
  const caseId = createCaseId(input.input.lifecycle.lookupCode, input.caseType);
  const evidenceHash = input.input.lifecycle.evidenceBundle.timestamp.evidenceHash || undefined;
  const partial: Omit<ArbiterReviewCase, "allowedActions"> = {
    caseId,
    lookupCode: input.input.lifecycle.lookupCode,
    publicLoanReference: input.input.lifecycle.publicLoanReference,
    caseType: input.caseType,
    status: "queued",
    priority: input.priority,
    reason: input.reason,
    relatedLifecycleStatus: input.input.lifecycle.lifecycleStatus,
    relatedLifecycleEventIds: matchedEvents.map((event) => event.id),
    relatedWatcherEventIds: matchedEvents.map((event) => event.payload.watcherEventId).filter((id): id is string => Boolean(id)),
    relatedEvidenceBundleId: input.input.lifecycle.evidenceBundle.bundleId,
    relatedEvidenceHash: evidenceHash,
    evidenceTimestampStatus: input.input.lifecycle.evidenceBundle.timestamp.status,
    borrowerSafeSummary: input.borrowerSafeSummary,
    arbiterInternalSummary: `${input.reason} Lifecycle=${input.input.lifecycle.lifecycleStatus}; collateral=${input.input.lifecycle.collateralLock.status}; fee=${input.input.lifecycle.dcrPlatformFeeOutput.status}; disbursement=${input.input.lifecycle.supplierDisbursement.status}; repayment=${input.input.lifecycle.repaymentDetection.status}; evidence=${input.input.lifecycle.evidenceBundle.status}/${input.input.lifecycle.evidenceBundle.timestamp.status}.`,
    openedAt: input.now,
    updatedAt: input.now,
    reviewDeadlineAt: addHours(input.now, DEFAULT_REVIEW_WINDOW_HOURS),
    assignedArbiter: "unassigned-arbiter-placeholder",
    decisions: [],
    safetyAuditNote: "Fixture/manual arbiter case scaffold. Review decisions do not execute chain actions or move funds.",
  };

  return {
    ...partial,
    allowedActions: buildAllowedArbiterActions(partial),
  };
}

function hasAnyEvent(events: HeadlessLifecycleEvent[], keys: string[]): boolean {
  return events.some((event) => keys.some((key) => Object.prototype.hasOwnProperty.call(event.payload, key)));
}

function isPlatformFeeIssue(event: HeadlessLifecycleEvent): boolean {
  return Boolean(event.payload.platformFeeVerifierStatus && event.payload.platformFeeVerifierStatus !== "valid");
}

function isCollateralIssue(event: HeadlessLifecycleEvent): boolean {
  return Boolean(event.payload.collateralVerifierStatus && event.payload.collateralVerifierStatus !== "confirmed");
}

function isDisbursementIssue(event: HeadlessLifecycleEvent): boolean {
  return Boolean(event.payload.supplierDisbursementVerifierStatus && event.payload.supplierDisbursementVerifierStatus !== "valid");
}

function isRepaymentIssue(event: HeadlessLifecycleEvent): boolean {
  return Boolean(event.payload.repaymentVerifierStatus && !event.payload.repaymentVerifierStatus.startsWith("valid_"));
}

function actionAllowedForCase(action: ArbiterActionType, caseType: ArbiterCaseType): boolean {
  if (action === "recognize_repayment") return caseType === "repayment_dispute";
  if (action === "recognize_top_up") return caseType === "collateral_issue" || caseType === "liquidation_health_review";
  if (action === "pause_liquidation") return caseType === "liquidation_health_review" || caseType === "watcher_stale_or_reorged";
  if (action === "confirm_liquidation_review") return caseType === "liquidation_health_review";
  return true;
}

function createCaseId(lookupCode: string, caseType: ArbiterCaseType): string {
  const compactLookup = lookupCode.replace(/[^a-zA-Z0-9]/g, "").slice(-12).toLowerCase();
  return `arb-${compactLookup}-${caseType}`;
}

function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function dedupeCases(cases: ArbiterReviewCase[]): ArbiterReviewCase[] {
  const byId = new Map<string, ArbiterReviewCase>();
  for (const reviewCase of cases) byId.set(reviewCase.caseId, reviewCase);
  return [...byId.values()];
}
