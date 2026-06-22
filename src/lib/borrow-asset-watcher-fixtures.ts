import type { HeadlessLifecycleEvent } from "./headless-lifecycle-events";
import type { HeadlessLoanLifecycleRecord } from "./headless-loan-lifecycle";
import type { BorrowAssetExpectedSettlementTerms, BorrowAssetWatcherEvent } from "./borrow-asset-watcher-events";
import { createFixtureBorrowAssetWatcherEvent } from "./borrow-asset-watcher-events";
import { mapRepaymentWatcherEvent, mapSupplierDisbursementWatcherEvent } from "./borrow-asset-watcher-adapter";

export type BorrowAssetWatcherFixtureScenario =
  | "valid_btc_supplier_disbursement"
  | "valid_usdc_supplier_disbursement"
  | "valid_usdt_supplier_disbursement"
  | "disbursement_amount_mismatch"
  | "disbursement_destination_mismatch"
  | "valid_partial_repayment"
  | "valid_full_repayment"
  | "repayment_wrong_asset"
  | "repayment_amount_mismatch"
  | "stale_watcher"
  | "reorged_watcher_event";

export function createFixtureBorrowAssetLifecycleEvent(input: {
  scenario: BorrowAssetWatcherFixtureScenario;
  lookupCode: string;
  lifecycle: HeadlessLoanLifecycleRecord;
  expectedDisbursement: BorrowAssetExpectedSettlementTerms;
  expectedRepayment: BorrowAssetExpectedSettlementTerms;
  observedAt?: string;
}): HeadlessLifecycleEvent {
  const event = createFixtureEvent(input.scenario, input.lookupCode, input.lifecycle, input.expectedDisbursement, input.expectedRepayment, input.observedAt);

  if (input.scenario.startsWith("valid_btc_supplier") || input.scenario.startsWith("valid_usdc_supplier") || input.scenario.startsWith("valid_usdt_supplier") || input.scenario.startsWith("disbursement")) {
    return mapSupplierDisbursementWatcherEvent(event, input.expectedDisbursement).lifecycleEvent;
  }

  return mapRepaymentWatcherEvent(event, input.lifecycle, input.expectedRepayment).lifecycleEvent;
}

function createFixtureEvent(
  scenario: BorrowAssetWatcherFixtureScenario,
  lookupCode: string,
  lifecycle: HeadlessLoanLifecycleRecord,
  expectedDisbursement: BorrowAssetExpectedSettlementTerms,
  expectedRepayment: BorrowAssetExpectedSettlementTerms,
  observedAt?: string,
): BorrowAssetWatcherEvent {
  const supplierPositionId = expectedDisbursement.supplierPositionId ?? lifecycle.supplierPositions[0]?.positionId ?? "supplier-position-fixture";
  const supplierFillId = expectedDisbursement.supplierFillId ?? lifecycle.acceptedSupplierFills[0]?.id ?? "supplier-fill-fixture";

  switch (scenario) {
    case "valid_btc_supplier_disbursement":
    case "valid_usdc_supplier_disbursement":
    case "valid_usdt_supplier_disbursement":
      return createFixtureBorrowAssetWatcherEvent({
        lookupCode,
        kind: "supplier_disbursement_confirmed",
        supplierPositionId,
        supplierFillId,
        asset: expectedDisbursement.asset,
        railNetwork: expectedDisbursement.railNetwork,
        observedAt,
        txid: `fixture-${expectedDisbursement.asset.toLowerCase()}-disbursement-tx`,
        outputIndex: expectedDisbursement.asset === "BTC" ? 0 : undefined,
        logIndex: expectedDisbursement.asset === "BTC" ? undefined : 12,
        tokenContract: expectedDisbursement.expectedTokenContract,
        fromAddress: expectedDisbursement.expectedFromAddress,
        toAddress: expectedDisbursement.expectedToAddress,
        observedAmount: expectedDisbursement.expectedAmount,
        expectedAmount: expectedDisbursement.expectedAmount,
        confirmations: expectedDisbursement.minConfirmations,
        finalityDepth: expectedDisbursement.minFinalityDepth ?? 0,
        blockHeight: 500,
        blockHash: "fixture-borrow-asset-disbursement-block",
      });
    case "disbursement_amount_mismatch":
      return createFixtureBorrowAssetWatcherEvent({
        lookupCode,
        kind: "supplier_disbursement_mismatch",
        supplierPositionId,
        supplierFillId,
        asset: expectedDisbursement.asset,
        railNetwork: expectedDisbursement.railNetwork,
        observedAt,
        txid: "fixture-disbursement-amount-mismatch",
        outputIndex: expectedDisbursement.asset === "BTC" ? 0 : undefined,
        logIndex: expectedDisbursement.asset === "BTC" ? undefined : 12,
        tokenContract: expectedDisbursement.expectedTokenContract,
        fromAddress: expectedDisbursement.expectedFromAddress,
        toAddress: expectedDisbursement.expectedToAddress,
        observedAmount: expectedDisbursement.expectedAmount / 2,
        expectedAmount: expectedDisbursement.expectedAmount,
        confirmations: expectedDisbursement.minConfirmations,
        finalityDepth: expectedDisbursement.minFinalityDepth ?? 0,
      });
    case "disbursement_destination_mismatch":
      return createFixtureBorrowAssetWatcherEvent({
        lookupCode,
        kind: "supplier_disbursement_mismatch",
        supplierPositionId,
        supplierFillId,
        asset: expectedDisbursement.asset,
        railNetwork: expectedDisbursement.railNetwork,
        observedAt,
        txid: "fixture-disbursement-destination-mismatch",
        tokenContract: expectedDisbursement.expectedTokenContract,
        fromAddress: expectedDisbursement.expectedFromAddress,
        toAddress: "wrong-borrower-address",
        observedAmount: expectedDisbursement.expectedAmount,
        expectedAmount: expectedDisbursement.expectedAmount,
        confirmations: expectedDisbursement.minConfirmations,
        finalityDepth: expectedDisbursement.minFinalityDepth ?? 0,
      });
    case "valid_partial_repayment":
      return createFixtureBorrowAssetWatcherEvent({
        lookupCode,
        kind: "repayment_confirmed",
        asset: expectedRepayment.asset,
        railNetwork: expectedRepayment.railNetwork,
        observedAt,
        txid: "fixture-partial-repayment-tx",
        outputIndex: expectedRepayment.asset === "BTC" ? 1 : undefined,
        logIndex: expectedRepayment.asset === "BTC" ? undefined : 19,
        tokenContract: expectedRepayment.expectedTokenContract,
        fromAddress: expectedRepayment.expectedFromAddress,
        toAddress: expectedRepayment.expectedToAddress,
        observedAmount: Math.max(lifecycle.repaymentAllocationPreview.remainingDue / 2, 1),
        expectedAmount: expectedRepayment.expectedAmount,
        confirmations: expectedRepayment.minConfirmations,
        finalityDepth: expectedRepayment.minFinalityDepth ?? 0,
        blockHeight: 600,
        blockHash: "fixture-partial-repayment-block",
      });
    case "valid_full_repayment":
      return createFixtureBorrowAssetWatcherEvent({
        lookupCode,
        kind: "repayment_confirmed",
        asset: expectedRepayment.asset,
        railNetwork: expectedRepayment.railNetwork,
        observedAt,
        txid: "fixture-full-repayment-tx",
        outputIndex: expectedRepayment.asset === "BTC" ? 1 : undefined,
        logIndex: expectedRepayment.asset === "BTC" ? undefined : 19,
        tokenContract: expectedRepayment.expectedTokenContract,
        fromAddress: expectedRepayment.expectedFromAddress,
        toAddress: expectedRepayment.expectedToAddress,
        observedAmount: lifecycle.repaymentAllocationPreview.remainingDue,
        expectedAmount: expectedRepayment.expectedAmount,
        confirmations: expectedRepayment.minConfirmations,
        finalityDepth: expectedRepayment.minFinalityDepth ?? 0,
        blockHeight: 601,
        blockHash: "fixture-full-repayment-block",
      });
    case "repayment_wrong_asset":
      return createFixtureBorrowAssetWatcherEvent({
        lookupCode,
        kind: "repayment_mismatch",
        asset: expectedRepayment.asset === "BTC" ? "USDC" : "BTC",
        railNetwork: expectedRepayment.asset === "BTC" ? "evm_testnet" : "bitcoin_testnet",
        observedAt,
        txid: "fixture-repayment-wrong-asset",
        toAddress: expectedRepayment.expectedToAddress,
        observedAmount: lifecycle.repaymentAllocationPreview.remainingDue,
        expectedAmount: expectedRepayment.expectedAmount,
        confirmations: expectedRepayment.minConfirmations,
      });
    case "repayment_amount_mismatch":
      return createFixtureBorrowAssetWatcherEvent({
        lookupCode,
        kind: "repayment_mismatch",
        asset: expectedRepayment.asset,
        railNetwork: expectedRepayment.railNetwork,
        observedAt,
        txid: "fixture-repayment-amount-mismatch",
        tokenContract: expectedRepayment.expectedTokenContract,
        fromAddress: expectedRepayment.expectedFromAddress,
        toAddress: expectedRepayment.expectedToAddress,
        observedAmount: 0,
        expectedAmount: expectedRepayment.expectedAmount,
        confirmations: expectedRepayment.minConfirmations,
        finalityDepth: expectedRepayment.minFinalityDepth ?? 0,
      });
    case "stale_watcher":
      return createFixtureBorrowAssetWatcherEvent({
        lookupCode,
        kind: "watcher_stale",
        asset: expectedRepayment.asset,
        railNetwork: expectedRepayment.railNetwork,
        observedAt,
        txid: "fixture-stale-borrow-asset-watcher",
        toAddress: expectedRepayment.expectedToAddress,
        observedAmount: lifecycle.repaymentAllocationPreview.remainingDue,
        expectedAmount: expectedRepayment.expectedAmount,
        confirmations: 0,
        riskStatus: "stale",
      });
    case "reorged_watcher_event":
      return createFixtureBorrowAssetWatcherEvent({
        lookupCode,
        kind: "watcher_reorged",
        asset: expectedRepayment.asset,
        railNetwork: expectedRepayment.railNetwork,
        observedAt,
        txid: "fixture-reorged-borrow-asset-event",
        toAddress: expectedRepayment.expectedToAddress,
        observedAmount: lifecycle.repaymentAllocationPreview.remainingDue,
        expectedAmount: expectedRepayment.expectedAmount,
        confirmations: 0,
        riskStatus: "reorged",
      });
  }
}
