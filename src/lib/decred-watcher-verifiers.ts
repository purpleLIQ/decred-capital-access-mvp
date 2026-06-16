import {
  type CollateralLockVerificationResult,
  type DecredExpectedOutputTerms,
  type DecredWatcherEvent,
  type PlatformFeeVerificationResult,
} from "./decred-watcher-events";

export function verifyDcrPlatformFeeOutput(
  event: DecredWatcherEvent,
  expected: DecredExpectedOutputTerms,
): PlatformFeeVerificationResult {
  if (event.kind === "platform_fee_output_missing") {
    return blocked("missing", event, "Expected DCR platform fee output is missing.");
  }
  if (event.riskStatus === "reorged" || event.kind === "collateral_reorged") {
    return blocked("reorged", event, "Observed platform fee output is affected by a reorg.");
  }
  if (event.riskStatus === "stale") {
    return blocked("stale", event, "Decred watcher is stale; fee output cannot be trusted yet.");
  }
  if ((event.confirmations ?? 0) < expected.minConfirmations) {
    return blocked("unconfirmed", event, "Platform fee output is seen but does not have enough confirmations.");
  }
  if (!amountMatches(event.amountDcr, expected.expectedAmountDcr)) {
    return blocked("amount_mismatch", event, "Platform fee output amount does not match expected DCR fee amount.");
  }
  if (event.observedAddressOrScript !== expected.expectedAddressOrScript) {
    return blocked("destination_mismatch", event, "Platform fee output destination does not match expected address/script descriptor.");
  }

  return {
    status: "valid",
    event,
    detail: "DCR platform fee output matches expected amount, destination, and confirmation depth.",
    blocksActivation: false,
  };
}

export function verifyDcrCollateralLock(
  event: DecredWatcherEvent,
  expected: DecredExpectedOutputTerms,
): CollateralLockVerificationResult {
  if (event.kind === "watcher_stale" || event.riskStatus === "stale") {
    return notSafe("stale", event, "Decred watcher is stale; collateral lock cannot be trusted yet.");
  }
  if (event.kind === "collateral_reorged" || event.riskStatus === "reorged") {
    return notSafe("reorged", event, "Collateral lock observation was reorged and must be rechecked.");
  }
  if (!event.txid) {
    return notSafe("missing", event, "No collateral funding transaction was observed.");
  }
  if (!amountMatches(event.amountDcr, expected.expectedAmountDcr)) {
    return notSafe("amount_mismatch", event, "Collateral amount does not match expected DCR amount.");
  }
  if (event.observedAddressOrScript !== expected.expectedAddressOrScript) {
    return notSafe("destination_mismatch", event, "Collateral destination does not match expected escrow address/script descriptor.");
  }
  if ((event.confirmations ?? 0) < expected.minConfirmations) {
    return {
      status: "observed_unconfirmed",
      event,
      detail: "Collateral output is observed but awaiting additional confirmations.",
      safeToProceed: false,
    };
  }

  return {
    status: "confirmed",
    event,
    detail: "Collateral output matches expected amount, destination, and confirmation depth.",
    safeToProceed: true,
  };
}

function blocked(status: PlatformFeeVerificationResult["status"], event: DecredWatcherEvent, detail: string): PlatformFeeVerificationResult {
  return {
    status,
    event,
    detail,
    blocksActivation: true,
  };
}

function notSafe(status: CollateralLockVerificationResult["status"], event: DecredWatcherEvent, detail: string): CollateralLockVerificationResult {
  return {
    status,
    event,
    detail,
    safeToProceed: false,
  };
}

function amountMatches(observed: number | undefined, expected: number): boolean {
  if (observed === undefined) return false;
  return Math.abs(observed - expected) < 0.00000001;
}
