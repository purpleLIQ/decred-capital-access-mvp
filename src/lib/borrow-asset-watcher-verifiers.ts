import type {
  BorrowAssetExpectedSettlementTerms,
  BorrowAssetWatcherEvent,
  RepaymentVerificationResult,
  SupplierDisbursementVerificationResult,
} from "./borrow-asset-watcher-events";
import type { HeadlessLoanLifecycleRecord } from "./headless-loan-lifecycle";

export function verifySupplierDisbursement(
  event: BorrowAssetWatcherEvent,
  expected: BorrowAssetExpectedSettlementTerms,
): SupplierDisbursementVerificationResult {
  if (event.kind === "supplier_disbursement_missing") return disbursementResult("missing", event, "Supplier disbursement was not observed.", false);
  if (event.riskStatus === "reorged" || event.kind === "watcher_reorged") return disbursementResult("reorged", event, "Supplier disbursement observation was reorged or invalidated.", false);
  if (event.riskStatus === "stale" || event.kind === "watcher_stale") return disbursementResult("stale", event, "Borrow-asset watcher is stale; disbursement cannot be trusted yet.", false);
  if (event.asset !== expected.asset) return disbursementResult("asset_mismatch", event, "Observed disbursement asset does not match expected asset.", false);
  if (!tokenContractMatches(event, expected)) return disbursementResult("token_contract_mismatch", event, "Observed token contract does not match expected token contract.", false);
  if (!amountMatches(event.observedAmount, expected.expectedAmount)) return disbursementResult("amount_mismatch", event, "Observed supplier disbursement amount does not match expected amount.", false);
  if (event.toAddress !== expected.expectedToAddress) return disbursementResult("destination_mismatch", event, "Observed supplier disbursement destination does not match expected borrower address.", false);
  if ((event.confirmations ?? 0) < expected.minConfirmations || (event.finalityDepth ?? 0) < (expected.minFinalityDepth ?? 0)) {
    return disbursementResult("unconfirmed", event, "Supplier disbursement is observed but awaiting confirmation/finality depth.", false);
  }

  return disbursementResult("valid", event, "Supplier disbursement matches expected asset, amount, destination, and confirmation/finality depth.", true);
}

export function verifyBorrowerRepayment(
  event: BorrowAssetWatcherEvent,
  lifecycle: HeadlessLoanLifecycleRecord,
  expected: BorrowAssetExpectedSettlementTerms,
): RepaymentVerificationResult {
  if (event.kind === "repayment_missing") return repaymentResult("missing", event, "Repayment was not observed.", 0, false);
  if (event.riskStatus === "reorged" || event.kind === "watcher_reorged") return repaymentResult("reorged", event, "Repayment observation was reorged or invalidated.", 0, false);
  if (event.riskStatus === "stale" || event.kind === "watcher_stale") return repaymentResult("stale", event, "Borrow-asset watcher is stale; repayment cannot be trusted yet.", 0, false);
  if (event.asset !== lifecycle.borrowAsset || event.asset !== expected.asset) return repaymentResult("asset_mismatch", event, "Observed repayment asset does not match expected borrow asset.", 0, false);
  if (!tokenContractMatches(event, expected)) return repaymentResult("token_contract_mismatch", event, "Observed token contract does not match expected repayment token contract.", 0, false);
  if (event.toAddress !== expected.expectedToAddress) return repaymentResult("destination_mismatch", event, "Observed repayment destination does not match expected repayment address.", 0, false);
  if ((event.confirmations ?? 0) < expected.minConfirmations || (event.finalityDepth ?? 0) < (expected.minFinalityDepth ?? 0)) {
    return repaymentResult("unconfirmed", event, "Repayment is observed but awaiting confirmation/finality depth.", 0, false);
  }

  const observedAmount = event.observedAmount ?? 0;
  const remainingDue = lifecycle.repaymentAllocationPreview.remainingDue;
  if (observedAmount <= 0) return repaymentResult("amount_mismatch", event, "Observed repayment amount is zero or missing.", 0, false);
  if (observedAmount + 0.00000001 < remainingDue) {
    return repaymentResult("valid_partial_repayment", event, "Partial repayment matches expected asset and destination.", observedAmount, false);
  }

  return repaymentResult("valid_full_repayment", event, "Full repayment matches expected asset, destination, and confirmation/finality depth.", observedAmount, true);
}

function disbursementResult(
  status: SupplierDisbursementVerificationResult["status"],
  event: BorrowAssetWatcherEvent,
  detail: string,
  safeToProceed: boolean,
): SupplierDisbursementVerificationResult {
  return { status, event, detail, safeToProceed };
}

function repaymentResult(
  status: RepaymentVerificationResult["status"],
  event: BorrowAssetWatcherEvent,
  detail: string,
  repaymentAmount: number,
  isFinalRepayment: boolean,
): RepaymentVerificationResult {
  return { status, event, detail, repaymentAmount, isFinalRepayment };
}

function amountMatches(observed: number | undefined, expected: number): boolean {
  if (observed === undefined) return false;
  return Math.abs(observed - expected) < 0.00000001;
}

function tokenContractMatches(event: BorrowAssetWatcherEvent, expected: BorrowAssetExpectedSettlementTerms): boolean {
  if (event.asset === "BTC") return true;
  return event.tokenContract?.toLowerCase() === expected.expectedTokenContract?.toLowerCase();
}
