import type { HeadlessLifecycleEvent } from "./headless-lifecycle-events";
import type { DecredExpectedOutputTerms, DecredWatcherEvent } from "./decred-watcher-events";
import { createFixtureDecredWatcherEvent } from "./decred-watcher-events";
import { mapCollateralWatcherEvent, mapPlatformFeeWatcherEvent } from "./decred-watcher-adapter";

export type DecredWatcherFixtureScenario =
  | "valid_collateral_lock_observed"
  | "valid_platform_fee_output_observed"
  | "missing_fee_output"
  | "fee_amount_mismatch"
  | "stale_watcher"
  | "reorged_collateral_event";

export function createFixtureWatcherLifecycleEvent(input: {
  scenario: DecredWatcherFixtureScenario;
  lookupCode: string;
  expectedCollateral: DecredExpectedOutputTerms;
  expectedPlatformFee: DecredExpectedOutputTerms;
  observedAt?: string;
}): HeadlessLifecycleEvent {
  const event = createFixtureWatcherEvent(input.scenario, input.lookupCode, input.expectedCollateral, input.expectedPlatformFee, input.observedAt);

  if (input.scenario === "valid_platform_fee_output_observed" || input.scenario === "missing_fee_output" || input.scenario === "fee_amount_mismatch") {
    return mapPlatformFeeWatcherEvent(event, input.expectedPlatformFee).lifecycleEvent;
  }

  return mapCollateralWatcherEvent(event, input.expectedCollateral).lifecycleEvent;
}

function createFixtureWatcherEvent(
  scenario: DecredWatcherFixtureScenario,
  lookupCode: string,
  expectedCollateral: DecredExpectedOutputTerms,
  expectedPlatformFee: DecredExpectedOutputTerms,
  observedAt?: string,
): DecredWatcherEvent {
  switch (scenario) {
    case "valid_collateral_lock_observed":
      return createFixtureDecredWatcherEvent({
        lookupCode,
        kind: "collateral_confirmed",
        observedAt,
        txid: "fixture-collateral-tx",
        outputIndex: 0,
        amountDcr: expectedCollateral.expectedAmountDcr,
        expectedAmountDcr: expectedCollateral.expectedAmountDcr,
        expectedAddressOrScript: expectedCollateral.expectedAddressOrScript,
        observedAddressOrScript: expectedCollateral.expectedAddressOrScript,
        confirmations: expectedCollateral.minConfirmations,
        blockHeight: 101,
        blockHash: "fixture-collateral-block",
      });
    case "valid_platform_fee_output_observed":
      return createFixtureDecredWatcherEvent({
        lookupCode,
        kind: "platform_fee_output_confirmed",
        observedAt,
        txid: "fixture-fee-tx",
        outputIndex: 1,
        amountDcr: expectedPlatformFee.expectedAmountDcr,
        expectedAmountDcr: expectedPlatformFee.expectedAmountDcr,
        expectedAddressOrScript: expectedPlatformFee.expectedAddressOrScript,
        observedAddressOrScript: expectedPlatformFee.expectedAddressOrScript,
        confirmations: expectedPlatformFee.minConfirmations,
        blockHeight: 102,
        blockHash: "fixture-fee-block",
      });
    case "missing_fee_output":
      return createFixtureDecredWatcherEvent({
        lookupCode,
        kind: "platform_fee_output_missing",
        observedAt,
        expectedAmountDcr: expectedPlatformFee.expectedAmountDcr,
        expectedAddressOrScript: expectedPlatformFee.expectedAddressOrScript,
        confirmations: 0,
      });
    case "fee_amount_mismatch":
      return createFixtureDecredWatcherEvent({
        lookupCode,
        kind: "platform_fee_output_mismatch",
        observedAt,
        txid: "fixture-fee-mismatch-tx",
        outputIndex: 1,
        amountDcr: expectedPlatformFee.expectedAmountDcr / 2,
        expectedAmountDcr: expectedPlatformFee.expectedAmountDcr,
        expectedAddressOrScript: expectedPlatformFee.expectedAddressOrScript,
        observedAddressOrScript: expectedPlatformFee.expectedAddressOrScript,
        confirmations: expectedPlatformFee.minConfirmations,
      });
    case "stale_watcher":
      return createFixtureDecredWatcherEvent({
        lookupCode,
        kind: "watcher_stale",
        observedAt,
        txid: "fixture-stale-tx",
        outputIndex: 0,
        amountDcr: expectedCollateral.expectedAmountDcr,
        expectedAmountDcr: expectedCollateral.expectedAmountDcr,
        expectedAddressOrScript: expectedCollateral.expectedAddressOrScript,
        observedAddressOrScript: expectedCollateral.expectedAddressOrScript,
        confirmations: 0,
        riskStatus: "stale",
      });
    case "reorged_collateral_event":
      return createFixtureDecredWatcherEvent({
        lookupCode,
        kind: "collateral_reorged",
        observedAt,
        txid: "fixture-reorged-tx",
        outputIndex: 0,
        amountDcr: expectedCollateral.expectedAmountDcr,
        expectedAmountDcr: expectedCollateral.expectedAmountDcr,
        expectedAddressOrScript: expectedCollateral.expectedAddressOrScript,
        observedAddressOrScript: expectedCollateral.expectedAddressOrScript,
        confirmations: 0,
        riskStatus: "reorged",
      });
  }
}
