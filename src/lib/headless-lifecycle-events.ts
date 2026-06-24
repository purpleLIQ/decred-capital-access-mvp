import type { EvidenceDigestAlgorithm, EvidenceTimestampProvider, EvidenceTimestampVerificationStatus } from "./evidence-timestamps";
import type { HeadlessLoanLifecycleRecord } from "./headless-loan-lifecycle";

export type LifecycleEventIntegrityStatus =
  | "accepted"
  | "duplicate"
  | "replayed"
  | "stale"
  | "out_of_order"
  | "unsafe_transition"
  | "contradictory"
  | "missing_required_context"
  | "needs_manual_review";

export type HeadlessLifecycleEventKind =
  | "borrower_quote_accepted"
  | "borrower_contact_updated"
  | "oracle_price_observed"
  | "collateral_lock_observed"
  | "dcr_platform_fee_output_observed"
  | "supplier_disbursement_ready"
  | "supplier_disbursement_observed"
  | "repayment_observed"
  | "collateral_release_ready"
  | "collateral_release_observed"
  | "liquidation_health_updated"
  | "borrower_warning_opened"
  | "top_up_requested"
  | "liquidation_review_confirmed"
  | "arbiter_review_requested"
  | "arbiter_review_resolved"
  | "evidence_bundle_prepared"
  | "evidence_commitment_observed"
  | "evidence_timestamp_prepared"
  | "evidence_timestamp_submitted"
  | "evidence_timestamp_anchored"
  | "evidence_timestamp_verified"
  | "evidence_timestamp_failed"
  | "lifecycle_event_integrity_checked";

export type HeadlessLifecycleEventSource = "borrower" | "supplier" | "arbiter" | "operator" | "watcher" | "oracle" | "system";

export type AffectedLifecycleSection =
  | "quoteStatus"
  | "borrowerContact"
  | "collateralLock"
  | "dcrPlatformFeeOutput"
  | "supplierDisbursement"
  | "repaymentDetection"
  | "collateralRelease"
  | "liquidationHealth"
  | "arbiterReview"
  | "evidenceBundle";

export interface HeadlessLifecycleEventPayload {
  status?: string;
  detail: string;
  amount?: number;
  asset?: HeadlessLoanLifecycleRecord["borrowAsset"] | "DCR";
  txid?: string;
  watcherEventId?: string;
  evidenceId?: string;
  reviewId?: string;
  health?: string;
  repaymentAmount?: number;
  evidenceHash?: string;
  digestAlgorithm?: EvidenceDigestAlgorithm;
  timestampProvider?: EvidenceTimestampProvider;
  submittedAt?: string;
  anchoredAt?: string;
  chainTimestamp?: string;
  merkleRoot?: string;
  merklePathPlaceholder?: string;
  verificationStatus?: EvidenceTimestampVerificationStatus;
  publicSummaryId?: string;
  timestampAuditNote?: string;
  decredWatcherKind?: string;
  decredNetwork?: string;
  outputIndex?: number;
  expectedAmountDcr?: number;
  expectedAddressOrScript?: string;
  observedAddressOrScript?: string;
  confirmations?: number;
  blockHeight?: number;
  blockHash?: string;
  watcherRiskStatus?: string;
  collateralVerifierStatus?: string;
  platformFeeVerifierStatus?: string;
  borrowAssetWatcherKind?: string;
  borrowAssetRailNetwork?: string;
  supplierPositionId?: string;
  supplierFillId?: string;
  logIndex?: number;
  tokenContract?: string;
  fromAddress?: string;
  toAddress?: string;
  expectedAmount?: number;
  finalityDepth?: number;
  supplierDisbursementVerifierStatus?: string;
  repaymentVerifierStatus?: string;
  healthResultId?: string;
  policyVersion?: string;
  oracleObservationIds?: string[];
  selectedDcrUsdPrice?: number;
  selectedBorrowAssetUsdPrice?: number;
  oracleSourceCount?: number;
  oracleFreshnessStatus?: string;
  oracleDeviationStatus?: string;
  oracleQuorumStatus?: string;
  oracleUsable?: boolean;
  oracleBlockerReason?: string;
  ltvBps?: number;
  collateralizationBps?: number;
  collateralValueUsd?: number;
  debtValueUsd?: number;
  warningWindowStatus?: string;
  warningDeadline?: string;
  topUpPlaceholderAmountDcr?: number;
  borrowerSafeSummary?: string;
  operatorInternalSummary?: string;
  nextBorrowerAction?: string;
  nextOperatorArbiterAction?: string;
  shouldOpenArbiterReview?: boolean;
  liquidationReviewEligible?: boolean;
  automaticLiquidationBlocked?: boolean;
  integrityStatus?: LifecycleEventIntegrityStatus;
  integrityApplied?: boolean;
  integrityReason?: string;
  integrityAuditNote?: string;
  integrityOriginalEventId?: string;
  integrityPreviousSummary?: string;
  integrityNextSummary?: string;
  integrityManualReviewRecommended?: boolean;
  arbiterDecisionId?: string;
}

export interface HeadlessLifecycleEvent {
  id: string;
  lookupCode: string;
  kind: HeadlessLifecycleEventKind;
  source: HeadlessLifecycleEventSource;
  payload: HeadlessLifecycleEventPayload;
  observedAt: string;
  createdAt: string;
  externalReference?: string;
  safetyAuditNote: string;
}

export interface LifecycleEventApplicationResult {
  event: HeadlessLifecycleEvent;
  affectedSection: AffectedLifecycleSection;
  record: HeadlessLoanLifecycleRecord;
}

export function createHeadlessLifecycleEvent(input: {
  lookupCode: string;
  kind: HeadlessLifecycleEventKind;
  source: HeadlessLifecycleEventSource;
  payload: HeadlessLifecycleEventPayload;
  observedAt?: string;
  createdAt?: string;
  externalReference?: string;
  safetyAuditNote?: string;
}): HeadlessLifecycleEvent {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const observedAt = input.observedAt ?? createdAt;

  return {
    id: createEventId(input.kind, input.lookupCode, createdAt),
    lookupCode: input.lookupCode,
    kind: input.kind,
    source: input.source,
    payload: input.payload,
    observedAt,
    createdAt,
    externalReference: input.externalReference ?? input.payload.txid ?? input.payload.watcherEventId ?? input.payload.evidenceId ?? input.payload.reviewId,
    safetyAuditNote: input.safetyAuditNote ?? "Manual lifecycle event accepted through the safe transition layer. No keys, signing, broadcast, or funds movement occurred.",
  };
}

export function getAffectedLifecycleSection(kind: HeadlessLifecycleEventKind): AffectedLifecycleSection {
  switch (kind) {
    case "borrower_quote_accepted":
      return "quoteStatus";
    case "borrower_contact_updated":
      return "borrowerContact";
    case "oracle_price_observed":
    case "lifecycle_event_integrity_checked":
      return "liquidationHealth";
    case "collateral_lock_observed":
      return "collateralLock";
    case "dcr_platform_fee_output_observed":
      return "dcrPlatformFeeOutput";
    case "supplier_disbursement_ready":
    case "supplier_disbursement_observed":
      return "supplierDisbursement";
    case "repayment_observed":
      return "repaymentDetection";
    case "collateral_release_ready":
    case "collateral_release_observed":
      return "collateralRelease";
    case "liquidation_health_updated":
    case "borrower_warning_opened":
    case "top_up_requested":
    case "liquidation_review_confirmed":
      return "liquidationHealth";
    case "arbiter_review_requested":
    case "arbiter_review_resolved":
      return "arbiterReview";
    case "evidence_bundle_prepared":
    case "evidence_commitment_observed":
    case "evidence_timestamp_prepared":
    case "evidence_timestamp_submitted":
    case "evidence_timestamp_anchored":
    case "evidence_timestamp_verified":
    case "evidence_timestamp_failed":
      return "evidenceBundle";
  }
}

function createEventId(kind: HeadlessLifecycleEventKind, lookupCode: string, createdAt: string): string {
  const compactLookup = lookupCode.replace(/[^a-zA-Z0-9]/g, "").slice(-12).toLowerCase();
  const compactTime = createdAt.replace(/[^0-9]/g, "").slice(0, 14);
  return `evt-${compactTime}-${compactLookup}-${kind}`;
}
