import { createHeadlessLifecycleEvent, type HeadlessLifecycleEvent } from "./headless-lifecycle-events";
import type { HeadlessLoanLifecycleRecord } from "./headless-loan-lifecycle";
import type {
  BorrowAssetExpectedSettlementTerms,
  BorrowAssetWatcherEvent,
  BorrowAssetWatcherLifecycleAdapterResult,
  RepaymentVerificationResult,
  SupplierDisbursementVerificationResult,
} from "./borrow-asset-watcher-events";
import { verifyBorrowerRepayment, verifySupplierDisbursement } from "./borrow-asset-watcher-verifiers";

export function mapSupplierDisbursementWatcherEvent(
  event: BorrowAssetWatcherEvent,
  expected: BorrowAssetExpectedSettlementTerms,
): BorrowAssetWatcherLifecycleAdapterResult {
  const verification = verifySupplierDisbursement(event, expected);
  return {
    watcherEvent: event,
    lifecycleEvent: supplierDisbursementLifecycleEvent(verification),
    verifierStatus: verification.status,
    affectedArea: "supplierDisbursement",
  };
}

export function mapRepaymentWatcherEvent(
  event: BorrowAssetWatcherEvent,
  lifecycle: HeadlessLoanLifecycleRecord,
  expected: BorrowAssetExpectedSettlementTerms,
): BorrowAssetWatcherLifecycleAdapterResult {
  const verification = verifyBorrowerRepayment(event, lifecycle, expected);
  return {
    watcherEvent: event,
    lifecycleEvent: repaymentLifecycleEvent(verification),
    verifierStatus: verification.status,
    affectedArea: "repaymentDetection",
  };
}

function supplierDisbursementLifecycleEvent(result: SupplierDisbursementVerificationResult): HeadlessLifecycleEvent {
  const event = result.event;
  return createHeadlessLifecycleEvent({
    lookupCode: event.lookupCode,
    kind: "supplier_disbursement_observed",
    source: event.source === "fixture" ? "system" : event.source,
    observedAt: event.observedAt,
    createdAt: event.observedAt,
    externalReference: event.txid ?? event.id,
    safetyAuditNote: event.safetyAuditNote,
    payload: {
      detail: `${result.detail} Watcher ${event.id}; asset ${event.asset}; rail ${event.railNetwork}; confirmations ${event.confirmations ?? 0}; finality ${event.finalityDepth ?? 0}; check ${result.status}.`,
      txid: event.txid,
      watcherEventId: event.id,
      amount: event.observedAmount,
      asset: event.asset,
      borrowAssetWatcherKind: event.kind,
      borrowAssetRailNetwork: event.railNetwork,
      supplierPositionId: event.supplierPositionId,
      supplierFillId: event.supplierFillId,
      outputIndex: event.outputIndex,
      logIndex: event.logIndex,
      tokenContract: event.tokenContract,
      fromAddress: event.fromAddress,
      toAddress: event.toAddress,
      expectedAmount: event.expectedAmount,
      confirmations: event.confirmations,
      finalityDepth: event.finalityDepth,
      blockHeight: event.blockHeight,
      blockHash: event.blockHash,
      watcherRiskStatus: event.riskStatus,
      supplierDisbursementVerifierStatus: result.status,
    },
  });
}

function repaymentLifecycleEvent(result: RepaymentVerificationResult): HeadlessLifecycleEvent {
  const event = result.event;
  return createHeadlessLifecycleEvent({
    lookupCode: event.lookupCode,
    kind: "repayment_observed",
    source: event.source === "fixture" ? "system" : event.source,
    observedAt: event.observedAt,
    createdAt: event.observedAt,
    externalReference: event.txid ?? event.id,
    safetyAuditNote: event.safetyAuditNote,
    payload: {
      detail: `${result.detail} Watcher ${event.id}; asset ${event.asset}; rail ${event.railNetwork}; confirmations ${event.confirmations ?? 0}; finality ${event.finalityDepth ?? 0}; check ${result.status}.`,
      txid: event.txid,
      watcherEventId: event.id,
      amount: result.repaymentAmount,
      repaymentAmount: result.repaymentAmount,
      asset: event.asset,
      borrowAssetWatcherKind: event.kind,
      borrowAssetRailNetwork: event.railNetwork,
      outputIndex: event.outputIndex,
      logIndex: event.logIndex,
      tokenContract: event.tokenContract,
      fromAddress: event.fromAddress,
      toAddress: event.toAddress,
      expectedAmount: event.expectedAmount,
      confirmations: event.confirmations,
      finalityDepth: event.finalityDepth,
      blockHeight: event.blockHeight,
      blockHash: event.blockHash,
      watcherRiskStatus: event.riskStatus,
      repaymentVerifierStatus: result.status,
    },
  });
}
