import { allocateRepaymentAcrossSupplierPositions } from "./supplier-repayment-allocation";
import type { EvidenceTimestampStatus } from "./evidence-timestamps";
import { updateEvidenceTimestampAnchor } from "./evidence-timestamps";
import type { HeadlessLoanLifecycleRecord } from "./headless-loan-lifecycle";
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

    case "collateral_lock_observed":
      return touch({
        ...record,
        lifecycleStatus: "awaiting_supplier_disbursement",
        collateralLock: {
          ...record.collateralLock,
          status: "locked",
          detail: `${detail}${externalReference}`,
          updatedAt,
        },
        nextBorrowerAction: "Collateral has been observed. Wait for supplier disbursement confirmation.",
        nextSupplierOperatorAction: "Collateral is locked. Review supplier disbursement readiness.",
      }, updatedAt);

    case "dcr_platform_fee_output_observed":
      return touch({
        ...record,
        dcrPlatformFeeOutput: {
          ...record.dcrPlatformFeeOutput,
          status: "detected",
          detail: `${detail}${externalReference}`,
          updatedAt,
        },
      }, updatedAt);

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

    case "supplier_disbursement_observed":
      return touch({
        ...record,
        lifecycleStatus: "repayment_pending",
        supplierDisbursement: {
          ...record.supplierDisbursement,
          status: "disbursed",
          detail: `${detail}${externalReference}`,
          updatedAt,
        },
        nextBorrowerAction: "Supplier disbursement has been observed. Track repayment deadline and prepare repayment.",
        nextSupplierOperatorAction: "Disbursement observed. Monitor repayment and collateral health.",
      }, updatedAt);

    case "repayment_observed": {
      const repaymentAmount = event.payload.repaymentAmount ?? event.payload.amount ?? record.repaymentAllocationPreview.repaymentAmount;
      const repaymentAllocationPreview = allocateRepaymentAcrossSupplierPositions({
        positions: record.supplierPositions,
        repaymentAmount,
      });
      return touch({
        ...record,
        repaymentAllocationPreview,
        repaymentDetection: {
          ...record.repaymentDetection,
          status: repaymentAllocationPreview.status === "repaid" ? "detected" : "partial",
          detail: `${detail}${externalReference}`,
          updatedAt,
        },
        collateralRelease: {
          ...record.collateralRelease,
          status: repaymentAllocationPreview.status === "repaid" ? "ready" : record.collateralRelease.status,
          detail: repaymentAllocationPreview.status === "repaid" ? "Repayment observed; collateral release can move to reviewed release workflow." : record.collateralRelease.detail,
          updatedAt,
        },
        nextBorrowerAction: repaymentAllocationPreview.status === "repaid" ? "Repayment observed. Wait for collateral release review." : "Partial repayment observed. Continue repayment until the remaining due is cleared.",
        nextSupplierOperatorAction: repaymentAllocationPreview.status === "repaid" ? "Review collateral release path." : "Continue monitoring repayment outputs.",
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

function normalizeLiquidationHealth(status?: string): HeadlessLoanLifecycleRecord["liquidationHealth"]["status"] {
  if (status === "watch" || status === "warning" || status === "liquidation_review") return status;
  return "healthy";
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
