import { createHeadlessLifecycleEvent, type HeadlessLifecycleEvent } from "./headless-lifecycle-events";
import type {
  CollateralLockVerificationResult,
  DecredExpectedOutputTerms,
  DecredWatcherEvent,
  DecredWatcherLifecycleAdapterResult,
  PlatformFeeVerificationResult,
} from "./decred-watcher-events";
import { verifyDcrCollateralLock, verifyDcrPlatformFeeOutput } from "./decred-watcher-verifiers";

export function mapCollateralWatcherEvent(
  event: DecredWatcherEvent,
  expected: DecredExpectedOutputTerms,
): DecredWatcherLifecycleAdapterResult {
  const verification = verifyDcrCollateralLock(event, expected);
  return {
    watcherEvent: event,
    lifecycleEvent: collateralLifecycleEvent(verification),
    verifierStatus: verification.status,
    affectedArea: "collateralLock",
  };
}

export function mapPlatformFeeWatcherEvent(
  event: DecredWatcherEvent,
  expected: DecredExpectedOutputTerms,
): DecredWatcherLifecycleAdapterResult {
  const verification = verifyDcrPlatformFeeOutput(event, expected);
  return {
    watcherEvent: event,
    lifecycleEvent: platformFeeLifecycleEvent(verification),
    verifierStatus: verification.status,
    affectedArea: "dcrPlatformFeeOutput",
  };
}

function collateralLifecycleEvent(result: CollateralLockVerificationResult): HeadlessLifecycleEvent {
  const event = result.event;
  return createHeadlessLifecycleEvent({
    lookupCode: event.lookupCode,
    kind: "collateral_lock_observed",
    source: event.source === "fixture" ? "system" : event.source,
    observedAt: event.observedAt,
    createdAt: event.observedAt,
    externalReference: event.txid ?? event.id,
    safetyAuditNote: event.safetyAuditNote,
    payload: {
      detail: `${result.detail} Watcher ${event.id}; network ${event.network}; confirmations ${event.confirmations ?? 0}; check ${result.status}.`,
      txid: event.txid,
      watcherEventId: event.id,
      amount: event.amountDcr,
      asset: "DCR",
      decredWatcherKind: event.kind,
      decredNetwork: event.network,
      outputIndex: event.outputIndex,
      expectedAmountDcr: event.expectedAmountDcr,
      expectedAddressOrScript: event.expectedAddressOrScript,
      observedAddressOrScript: event.observedAddressOrScript,
      confirmations: event.confirmations,
      blockHeight: event.blockHeight,
      blockHash: event.blockHash,
      watcherRiskStatus: event.riskStatus,
      collateralVerifierStatus: result.status,
    },
  });
}

function platformFeeLifecycleEvent(result: PlatformFeeVerificationResult): HeadlessLifecycleEvent {
  const event = result.event;
  return createHeadlessLifecycleEvent({
    lookupCode: event.lookupCode,
    kind: "dcr_platform_fee_output_observed",
    source: event.source === "fixture" ? "system" : event.source,
    observedAt: event.observedAt,
    createdAt: event.observedAt,
    externalReference: event.txid ?? event.id,
    safetyAuditNote: event.safetyAuditNote,
    payload: {
      detail: `${result.detail} Watcher ${event.id}; network ${event.network}; confirmations ${event.confirmations ?? 0}; check ${result.status}; blocked ${result.blocksActivation}.`,
      txid: event.txid,
      watcherEventId: event.id,
      amount: event.amountDcr,
      asset: "DCR",
      decredWatcherKind: event.kind,
      decredNetwork: event.network,
      outputIndex: event.outputIndex,
      expectedAmountDcr: event.expectedAmountDcr,
      expectedAddressOrScript: event.expectedAddressOrScript,
      observedAddressOrScript: event.observedAddressOrScript,
      confirmations: event.confirmations,
      blockHeight: event.blockHeight,
      blockHash: event.blockHash,
      watcherRiskStatus: event.riskStatus,
      platformFeeVerifierStatus: result.status,
    },
  });
}
