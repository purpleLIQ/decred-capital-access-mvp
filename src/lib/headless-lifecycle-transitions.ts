import { allocateRepaymentAcrossSupplierPositions } from "./supplier-repayment-allocation";
import type { EvidenceTimestampStatus } from "./evidence-timestamps";
import { updateEvidenceTimestampAnchor } from "./evidence-timestamps";
import type {
  BorrowerWarningWindow,
  HeadlessLiquidationHealthStatus,
  HeadlessLoanLifecycleRecord,
  LifecycleOracleHealthSummary,
} from "./headless-loan-lifecycle";
import type { HeadlessLifecycleStore } from "./headless-lifecycle-store";
import { headlessLifecycleStore } from "./headless-lifecycle-store";
import type { HeadlessLifecycleEvent, LifecycleEventApplicationResult } from "./headless-lifecycle-events";
import { getAffectedLifecycleSection } from "./headless-lifecycle-events";

export async function applyHeadlessLifecycleEvent(
  event: HeadlessLifecycleEvent,
  store: HeadlessLifecycleStore = headlessLifecycleStore,
): Promise<LifecycleEventApplicationResult | null> {
  const existing = await store.findByLookupCode(event.lookupCode);
  if (!existing) return null;

  const record = transitionRecord(existing, event);
  const saved = await store.save(record);

  return {
    event,
    affectedSection: getAffectedLifecycleSection(event.kind),
    record: saved,
  };
}

function transitionRecord(record: HeadlessLoanLifecycleRecord, event: HeadlessLifecycleEvent): HeadlessLoanLifecycleRecord {
  const updatedAt = event.observedAt;
  const detail = event.payload.detail;
  const externalReference = event.externalReference ? ` Reference: ${event.externalReference}.` : "";

  switch (event.kind) {
    case "borrower_quote_accepted":
      return touch({
        ...record,
        quoteStatus: "accepted",
        lifecycleStatus: "awaiting_collateral_lock",
        nextBorrowerAction: "Save the lookup code, then prepare for collateral lock once wallet funding is available.",
        nextSupplierOperatorAction: "Review supplier positions and prepare disbursement once collateral lock is confirmed.",
      }, updatedAt);

    case "borrower_contact_updated":
      return touch(record, updatedAt);

    case "lifecycle_event_integrity_checked":
      return touch(record, updatedAt);

    case "oracle_price_observed":
      return touch({
        ...record,
        oracleHealth: mergeOracleHealthSummary(record, event, normalizeLiquidationHealth(event.payload.status ?? event.payload.health)),
        liquidationHealth: {
          ...record.liquidationHealth,
          detail: `${detail}${externalReference}`,
          updatedAt,
        },
      }, updatedAt);

    case "collateral_lock_observed": {
      const status = collateralStatusFromWatcher(event.payload.collateralVerifierStatus);
      const isLocked = status === "locked";
      return touch({
        ...record,
        lifecycleStatus: isLocked ? "awaiting_supplier_disbursement" : record.lifecycleStatus,
        collateralLock: {
          ...record.collateralLock,
          status,
          detail: `${detail}${externalReference}`,
          updatedAt,
        },
        nextBorrowerAction: isLocked ? "Collateral has been observed. Wait for supplier disbursement confirmation." : collateralBorrowerMessage(status),
        nextSupplierOperatorAction: isLocked ? "Collateral is locked. Review supplier disbursement readiness." : "Review Decred watcher collateral status before proceeding.",
      }, updatedAt);
    }

    case "dcr_platform_fee_output_observed": {
      const status = feeStatusFromWatcher(event.payload.platformFeeVerifierStatus);
      return touch({
        ...record,
        dcrPlatformFeeOutput: {
          ...record.dcrPlatformFeeOutput,
          status,
          detail: `${detail}${externalReference}`,
          updatedAt,
        },
        nextSupplierOperatorAction: status === "detected" ? record.nextSupplierOperatorAction : "Review DCR platform fee output before proceeding.",
      }, updatedAt);
    }

    case "supplier_disbursement_ready":
      return touch({
        ...record,
        supplierDisbursement: {
          ...record.supplierDisbursement,
          status: "ready",
          detail,
          updatedAt,
        },
        nextSupplierOperatorAction: "Supplier disbursement is ready for reviewed wallet execution outside the app.",
      }, updatedAt);

    case "supplier_disbursement_observed": {
      const isValid = event.payload.supplierDisbursementVerifierStatus === undefined || event.payload.supplierDisbursementVerifierStatus === "valid";
      return touch({
        ...record,
        lifecycleStatus: isValid ? "repayment_pending" : record.lifecycleStatus,
        supplierDisbursement: {
          ...record.supplierDisbursement,
          status: isValid ? "disbursed" : record.supplierDisbursement.status,
          detail: `${detail}${externalReference}`,
          updatedAt,
        },
        nextBorrowerAction: isValid ? "Supplier disbursement has been observed. Track repayment deadline and prepare repayment." : "Watcher issue detected for supplier disbursement. Wait for confirmation or operator review.",
        nextSupplierOperatorAction: isValid ? "Disbursement observed. Monitor repayment and collateral health." : "Review borrow-asset watcher disbursement status before proceeding.",
      }, updatedAt);
    }

    case "repayment_observed": {
      const isValidRepayment = event.payload.repaymentVerifierStatus === undefined || event.payload.repaymentVerifierStatus === "valid_full_repayment" || event.payload.repaymentVerifierStatus === "valid_partial_repayment";
      const repaymentAmount = isValidRepayment ? event.payload.repaymentAmount ?? event.payload.amount ?? record.repaymentAllocationPreview.repaymentAmount : record.repaymentAllocationPreview.repaymentAmount;
      const repaymentAllocationPreview = allocateRepaymentAcrossSupplierPositions({
        positions: record.supplierPositions,
        repaymentAmount,
      });
      const repaymentStatus = isValidRepayment
        ? repaymentAllocationPreview.status === "repaid"
          ? "detected"
          : "partial"
        : record.repaymentDetection.status;
      return touch({
        ...record,
        repaymentAllocationPreview,
        repaymentDetection: {
          ...record.repaymentDetection,
          status: repaymentStatus,
          detail: `${detail}${externalReference}`,
          updatedAt,
        },
        collateralRelease: {
          ...record.collateralRelease,
          status: isValidRepayment && repaymentAllocationPreview.status === "repaid" ? "ready" : record.collateralRelease.status,
          detail: isValidRepayment && repaymentAllocationPreview.status === "repaid" ? "Repayment observed; collateral release can move to reviewed release workflow." : record.collateralRelease.detail,
          updatedAt,
        },
        nextBorrowerAction: isValidRepayment
          ? repaymentAllocationPreview.status === "repaid"
            ? "Repayment observed. Wait for collateral release review."
            : "Partial repayment observed. Continue repayment until the remaining due is cleared."
          : "Watcher issue detected for repayment. Wait for confirmation or operator review.",
        nextSupplierOperatorAction: isValidRepayment
          ? repaymentAllocationPreview.status === "repaid"
            ? "Review collateral release path."
            : "Continue monitoring repayment outputs."
          : "Review borrow-asset watcher repayment status before proceeding.",
      }, updatedAt);
    }

    case "collateral_release_ready":
      return touch({
        ...record,
        collateralRelease: {
          ...record.collateralRelease,
          status: "ready",
          detail,
          updatedAt,
        },
        nextSupplierOperatorAction: "Collateral release is ready for reviewed wallet execution outside the app.",
      }, updatedAt);

    case "collateral_release_observed":
      return touch({
        ...record,
        lifecycleStatus: "ready_for_lookup",
        collateralRelease: {
          ...record.collateralRelease,
          status: "released",
          detail: `${detail}${externalReference}`,
          updatedAt,
        },
        nextBorrowerAction: "Collateral release observed. Loan lifecycle is closed for borrower lookup.",
        nextSupplierOperatorAction: "Loan closed; retain event history for audit/debug.",
      }, updatedAt);

    case "liquidation_health_updated":
      return touch({
        ...record,
        liquidationHealth: {
          ...record.liquidationHealth,
          status: normalizeLiquidationHealth(event.payload.status ?? event.payload.health),
          detail,
          updatedAt,
        },
        oracleHealth: mergeOracleHealthSummary(record, event, normalizeLiquidationHealth(event.payload.status ?? event.payload.health)),
        borrowerWarningWindow: mergeWarningWindow(record.borrowerWarningWindow, event, updatedAt),
        nextBorrowerAction: event.payload.nextBorrowerAction ?? event.payload.borrowerSafeSummary ?? record.nextBorrowerAction,
        nextSupplierOperatorAction: event.payload.nextOperatorArbiterAction ?? event.payload.operatorInternalSummary ?? record.nextSupplierOperatorAction,
        arbiterReview: event.payload.shouldOpenArbiterReview
          ? {
              ...record.arbiterReview,
              status: "requested",
              detail: "Arbiter review is requested from liquidation health policy output.",
              updatedAt,
            }
          : record.arbiterReview,
      }, updatedAt);

    case "borrower_warning_opened":
      return touch({
        ...record,
        borrowerWarningWindow: mergeWarningWindow(record.borrowerWarningWindow, event, updatedAt),
        liquidationHealth: {
          ...record.liquidationHealth,
          status: normalizeLiquidationHealth(event.payload.status ?? event.payload.health),
          detail: `${detail}${externalReference}`,
          updatedAt,
        },
        nextBorrowerAction: event.payload.nextBorrowerAction ?? event.payload.borrowerSafeSummary ?? "Loan health is under review.",
      }, updatedAt);

    case "top_up_requested":
      return touch({
        ...record,
        borrowerWarningWindow: {
          ...mergeWarningWindow(record.borrowerWarningWindow, event, updatedAt),
          status: "top_up_requested",
          topUpRequested: true,
        },
        liquidationHealth: {
          ...record.liquidationHealth,
          status: normalizeLiquidationHealth(event.payload.status ?? event.payload.health),
          detail: `${detail}${externalReference}`,
          updatedAt,
        },
        nextBorrowerAction: event.payload.nextBorrowerAction ?? "Top-up may be required. Watch for reviewed top-up instructions.",
        nextSupplierOperatorAction: event.payload.nextOperatorArbiterAction ?? "Prepare arbiter review evidence for the top-up request.",
      }, updatedAt);

    case "liquidation_review_confirmed":
      return touch({
        ...record,
        liquidationHealth: {
          ...record.liquidationHealth,
          status: event.payload.health === "liquidation_eligible" ? "liquidation_eligible" : "liquidation_review",
          detail: `${detail}${externalReference}`,
          updatedAt,
        },
        oracleHealth: mergeOracleHealthSummary(record, event, normalizeLiquidationHealth(event.payload.status ?? event.payload.health ?? "liquidation_review")),
        nextSupplierOperatorAction: event.payload.nextOperatorArbiterAction ?? "Liquidation review is eligible for arbiter/manual review only. Execution remains blocked.",
      }, updatedAt);

    case "arbiter_review_requested":
      return touch({
        ...record,
        arbiterReview: {
          ...record.arbiterReview,
          status: "requested",
          detail: `${detail}${externalReference}`,
          updatedAt,
        },
        nextBorrowerAction: "Arbiter review is open. Watch this lookup page for resolution.",
        nextSupplierOperatorAction: "Arbiter review requested. Await reviewed resolution.",
      }, updatedAt);

    case "arbiter_review_resolved":
      return touch({
        ...record,
        arbiterReview: {
          ...record.arbiterReview,
          status: "resolved",
          detail: `${detail}${externalReference}`,
          updatedAt,
        },
      }, updatedAt);

    case "evidence_bundle_prepared":
      return touch({
        ...record,
        evidenceBundle: {
          ...record.evidenceBundle,
          status: "prepared",
          detail: `${detail}${externalReference}`,
          updatedAt,
          bundleId: event.payload.evidenceId ?? record.evidenceBundle.bundleId,
        },
      }, updatedAt);

    case "evidence_commitment_observed":
      return touch({
        ...record,
        evidenceBundle: {
          ...record.evidenceBundle,
          status: "committed",
          detail: `${detail}${externalReference}`,
          updatedAt,
          bundleId: event.payload.evidenceId ?? record.evidenceBundle.bundleId,
        },
      }, updatedAt);

    case "evidence_timestamp_prepared":
      return updateTimestamp(record, event, "prepared", "prepared");
    case "evidence_timestamp_submitted":
      return updateTimestamp(record, event, "submitted", record.evidenceBundle.status);
    case "evidence_timestamp_anchored":
      return updateTimestamp(record, event, "anchored", "committed");
    case "evidence_timestamp_verified":
      return updateTimestamp(record, event, "verified", "committed");
    case "evidence_timestamp_failed":
      return updateTimestamp(record, event, "failed", record.evidenceBundle.status);
  }
}

function updateTimestamp(
  record: HeadlessLoanLifecycleRecord,
  event: HeadlessLifecycleEvent,
  timestampStatus: EvidenceTimestampStatus,
  bundleStatus: HeadlessLoanLifecycleRecord["evidenceBundle"]["status"],
): HeadlessLoanLifecycleRecord {
  const updatedAt = event.observedAt;
  const timestamp = updateEvidenceTimestampAnchor(record.evidenceBundle.timestamp, {
    evidenceHash: event.payload.evidenceHash,
    digestAlgorithm: event.payload.digestAlgorithm,
    provider: event.payload.timestampProvider,
    submittedAt: event.payload.submittedAt,
    anchoredAt: event.payload.anchoredAt,
    chainTimestamp: event.payload.chainTimestamp,
    txid: event.payload.txid,
    merkleRoot: event.payload.merkleRoot,
    merklePathPlaceholder: event.payload.merklePathPlaceholder,
    verificationStatus: event.payload.verificationStatus,
    publicSummaryId: event.payload.publicSummaryId,
    auditNote: event.payload.timestampAuditNote ?? "Timestamp event stores only audit-safe hash metadata. Full evidence remains off-chain.",
  }, timestampStatus);

  return touch({
    ...record,
    evidenceBundle: {
      ...record.evidenceBundle,
      status: bundleStatus,
      detail: event.payload.detail,
      updatedAt,
      bundleId: event.payload.evidenceId ?? record.evidenceBundle.bundleId,
      timestamp,
    },
  }, updatedAt);
}

function feeStatusFromWatcher(status?: string): HeadlessLoanLifecycleRecord["dcrPlatformFeeOutput"]["status"] {
  if (status === "valid") return "detected";
  if (status === "missing" || status === "amount_mismatch" || status === "destination_mismatch" || status === "unconfirmed" || status === "stale" || status === "reorged") return "not_started";
  return "detected";
}

function collateralStatusFromWatcher(status?: string): HeadlessLoanLifecycleRecord["collateralLock"]["status"] {
  if (status === "confirmed") return "locked";
  if (status === "observed_unconfirmed") return "awaiting_borrower";
  if (status === "amount_mismatch" || status === "destination_mismatch" || status === "stale" || status === "reorged" || status === "missing") return "failed";
  return "locked";
}

function collateralBorrowerMessage(status: HeadlessLoanLifecycleRecord["collateralLock"]["status"]): string {
  if (status === "awaiting_borrower") return "Collateral is observed and waiting for confirmations.";
  if (status === "failed") return "Collateral issue detected. Wait for operator review before continuing.";
  return "Waiting for collateral.";
}

function normalizeLiquidationHealth(status?: string): HeadlessLoanLifecycleRecord["liquidationHealth"]["status"] {
  if (
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

function mergeOracleHealthSummary(
  record: HeadlessLoanLifecycleRecord,
  event: HeadlessLifecycleEvent,
  status: HeadlessLiquidationHealthStatus,
): LifecycleOracleHealthSummary {
  const current = record.oracleHealth ?? fallbackOracleHealthSummary(event.observedAt);
  return {
    ...current,
    resultId: event.payload.healthResultId ?? current.resultId,
    policyVersion: event.payload.policyVersion ?? current.policyVersion,
    status,
    ltvBps: event.payload.ltvBps ?? current.ltvBps,
    collateralizationBps: event.payload.collateralizationBps ?? current.collateralizationBps,
    collateralValueUsd: event.payload.collateralValueUsd ?? current.collateralValueUsd,
    debtValueUsd: event.payload.debtValueUsd ?? current.debtValueUsd,
    selectedDcrUsdPrice: event.payload.selectedDcrUsdPrice ?? current.selectedDcrUsdPrice,
    selectedBorrowAssetUsdPrice: event.payload.selectedBorrowAssetUsdPrice ?? current.selectedBorrowAssetUsdPrice,
    oracleSourceCount: event.payload.oracleSourceCount ?? current.oracleSourceCount,
    oracleFreshnessStatus: event.payload.oracleFreshnessStatus ?? current.oracleFreshnessStatus,
    oracleDeviationStatus: event.payload.oracleDeviationStatus ?? current.oracleDeviationStatus,
    oracleQuorumStatus: event.payload.oracleQuorumStatus ?? current.oracleQuorumStatus,
    oracleUsable: event.payload.oracleUsable ?? (!event.payload.oracleBlockerReason ? true : false),
    blockerReason: event.payload.oracleBlockerReason ?? current.blockerReason,
    borrowerSafeSummary: event.payload.borrowerSafeSummary ?? current.borrowerSafeSummary,
    operatorInternalSummary: event.payload.operatorInternalSummary ?? current.operatorInternalSummary,
    nextBorrowerAction: event.payload.nextBorrowerAction ?? current.nextBorrowerAction,
    nextOperatorArbiterAction: event.payload.nextOperatorArbiterAction ?? current.nextOperatorArbiterAction,
    shouldOpenArbiterReview: event.payload.shouldOpenArbiterReview ?? current.shouldOpenArbiterReview,
    liquidationReviewEligible: event.payload.liquidationReviewEligible ?? current.liquidationReviewEligible,
    automaticLiquidationBlocked: event.payload.automaticLiquidationBlocked ?? true,
    auditNote: "Oracle health summary was updated through the safe lifecycle event path. No liquidation execution occurred.",
    updatedAt: event.observedAt,
  };
}

function mergeWarningWindow(
  current: BorrowerWarningWindow | undefined,
  event: HeadlessLifecycleEvent,
  updatedAt: string,
): BorrowerWarningWindow {
  const fallback: BorrowerWarningWindow = {
    status: "not_required",
    topUpRequested: false,
    topUpPlaceholderAmountDcr: 0,
    borrowerSafeMessage: "Healthy",
    updatedAt,
  };
  const base = current ?? fallback;
  return {
    ...base,
    status: normalizeWarningWindowStatus(event.payload.warningWindowStatus, base.status),
    warningOpenedAt: event.payload.warningWindowStatus && event.payload.warningWindowStatus !== "not_required"
      ? base.warningOpenedAt ?? event.observedAt
      : base.warningOpenedAt,
    warningDeadline: event.payload.warningDeadline ?? base.warningDeadline,
    topUpRequested: event.payload.warningWindowStatus === "top_up_requested" || base.topUpRequested,
    topUpPlaceholderAmountDcr: event.payload.topUpPlaceholderAmountDcr ?? base.topUpPlaceholderAmountDcr,
    borrowerSafeMessage: event.payload.borrowerSafeSummary ?? base.borrowerSafeMessage,
    updatedAt,
  };
}

function normalizeWarningWindowStatus(status: string | undefined, fallback: BorrowerWarningWindow["status"]): BorrowerWarningWindow["status"] {
  if (status === "not_required" || status === "warning_open" || status === "top_up_requested" || status === "grace_expired" || status === "resolved" || status === "blocked") return status;
  return fallback;
}

function fallbackOracleHealthSummary(updatedAt: string): LifecycleOracleHealthSummary {
  return {
    resultId: "health-not-evaluated",
    policyVersion: "not_evaluated",
    status: "healthy",
    ltvBps: 0,
    collateralizationBps: 0,
    collateralValueUsd: 0,
    debtValueUsd: 0,
    selectedDcrUsdPrice: 0,
    selectedBorrowAssetUsdPrice: 0,
    oracleSourceCount: 0,
    oracleFreshnessStatus: "missing",
    oracleDeviationStatus: "missing",
    oracleQuorumStatus: "missing",
    oracleUsable: false,
    blockerReason: "Oracle health has not been evaluated.",
    borrowerSafeSummary: "Healthy",
    operatorInternalSummary: "Oracle/liquidation health policy has not run for this record yet.",
    nextBorrowerAction: "No collateral health action is required.",
    nextOperatorArbiterAction: "Run fixture/manual oracle health evaluation when watcher evidence is available.",
    shouldOpenArbiterReview: false,
    liquidationReviewEligible: false,
    automaticLiquidationBlocked: true,
    auditNote: "Fallback oracle health summary.",
    updatedAt,
  };
}

function touch(record: HeadlessLoanLifecycleRecord, updatedAt: string): HeadlessLoanLifecycleRecord {
  return {
    ...record,
    timestamps: {
      ...record.timestamps,
      lastUpdatedAt: updatedAt,
    },
  };
}
