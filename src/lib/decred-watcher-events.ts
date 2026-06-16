import type { HeadlessLifecycleEvent } from "./headless-lifecycle-events";

export type DecredWatcherEventKind =
  | "collateral_funding_seen"
  | "collateral_confirmed"
  | "collateral_reorged"
  | "collateral_spent"
  | "platform_fee_output_seen"
  | "platform_fee_output_confirmed"
  | "platform_fee_output_missing"
  | "platform_fee_output_mismatch"
  | "watcher_stale"
  | "watcher_recovered";

export type DecredWatcherSource = "watcher" | "operator" | "system" | "fixture";
export type DecredNetwork = "simnet" | "testnet" | "mainnet" | "unknown";
export type DecredWatcherRiskStatus = "normal" | "stale" | "reorg_risk" | "reorged";

export interface DecredWatcherEvent {
  id: string;
  lookupCode: string;
  kind: DecredWatcherEventKind;
  observedAt: string;
  source: DecredWatcherSource;
  network: DecredNetwork;
  txid?: string;
  outputIndex?: number;
  amountDcr?: number;
  expectedAmountDcr?: number;
  expectedAddressOrScript?: string;
  observedAddressOrScript?: string;
  confirmations?: number;
  blockHeight?: number;
  blockHash?: string;
  riskStatus: DecredWatcherRiskStatus;
  safetyAuditNote: string;
}

export interface DecredExpectedOutputTerms {
  lookupCode: string;
  expectedAmountDcr: number;
  expectedAddressOrScript: string;
  minConfirmations: number;
  network: DecredNetwork;
}

export type PlatformFeeVerificationStatus =
  | "valid"
  | "missing"
  | "amount_mismatch"
  | "destination_mismatch"
  | "unconfirmed"
  | "stale"
  | "reorged";

export type CollateralLockVerificationStatus =
  | "observed_unconfirmed"
  | "confirmed"
  | "amount_mismatch"
  | "destination_mismatch"
  | "stale"
  | "reorged"
  | "missing";

export interface PlatformFeeVerificationResult {
  status: PlatformFeeVerificationStatus;
  event: DecredWatcherEvent;
  detail: string;
  blocksActivation: boolean;
}

export interface CollateralLockVerificationResult {
  status: CollateralLockVerificationStatus;
  event: DecredWatcherEvent;
  detail: string;
  safeToProceed: boolean;
}

export interface DecredWatcherLifecycleAdapterResult {
  watcherEvent: DecredWatcherEvent;
  lifecycleEvent: HeadlessLifecycleEvent;
  verifierStatus: PlatformFeeVerificationStatus | CollateralLockVerificationStatus;
  affectedArea: "collateralLock" | "dcrPlatformFeeOutput";
}

export function createFixtureDecredWatcherEvent(input: Omit<DecredWatcherEvent, "id" | "observedAt" | "source" | "network" | "riskStatus" | "safetyAuditNote"> & Partial<Pick<DecredWatcherEvent, "id" | "observedAt" | "source" | "network" | "riskStatus" | "safetyAuditNote">>): DecredWatcherEvent {
  const observedAt = input.observedAt ?? new Date().toISOString();
  return {
    ...input,
    id: input.id ?? createWatcherEventId(input.kind, input.lookupCode, observedAt),
    observedAt,
    source: input.source ?? "fixture",
    network: input.network ?? "simnet",
    riskStatus: input.riskStatus ?? "normal",
    safetyAuditNote: input.safetyAuditNote ?? "Fixture Decred watcher event. No live node call, signing, broadcast, or fund movement occurred.",
  };
}

function createWatcherEventId(kind: DecredWatcherEventKind, lookupCode: string, observedAt: string): string {
  const compactLookup = lookupCode.replace(/[^a-zA-Z0-9]/g, "").slice(-12).toLowerCase();
  const compactTime = observedAt.replace(/[^0-9]/g, "").slice(0, 14);
  return `dcrwatch-${compactTime}-${compactLookup}-${kind}`;
}
