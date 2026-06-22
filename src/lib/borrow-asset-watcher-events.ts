import type { HeadlessLifecycleEvent } from "./headless-lifecycle-events";
import type { Loan } from "./types";

export type BorrowAssetWatcherEventKind =
  | "supplier_disbursement_seen"
  | "supplier_disbursement_confirmed"
  | "supplier_disbursement_missing"
  | "supplier_disbursement_mismatch"
  | "repayment_seen"
  | "repayment_confirmed"
  | "repayment_missing"
  | "repayment_mismatch"
  | "watcher_stale"
  | "watcher_recovered"
  | "watcher_reorged";

export type BorrowAssetRailNetwork =
  | "bitcoin_simnet"
  | "bitcoin_testnet"
  | "bitcoin_mainnet"
  | "evm_local"
  | "evm_testnet"
  | "evm_mainnet"
  | "unknown";

export type BorrowAssetWatcherSource = "watcher" | "operator" | "system" | "fixture";
export type BorrowAssetWatcherRiskStatus = "normal" | "stale" | "unfinalized" | "reorg_risk" | "reorged";

export interface BorrowAssetWatcherEvent {
  id: string;
  lookupCode: string;
  kind: BorrowAssetWatcherEventKind;
  supplierPositionId?: string;
  supplierFillId?: string;
  asset: Loan["borrowAsset"];
  railNetwork: BorrowAssetRailNetwork;
  observedAt: string;
  source: BorrowAssetWatcherSource;
  txid?: string;
  outputIndex?: number;
  logIndex?: number;
  tokenContract?: string;
  fromAddress?: string;
  toAddress?: string;
  observedAmount?: number;
  expectedAmount?: number;
  confirmations?: number;
  finalityDepth?: number;
  blockHeight?: number;
  blockHash?: string;
  riskStatus: BorrowAssetWatcherRiskStatus;
  safetyAuditNote: string;
}

export interface BorrowAssetExpectedSettlementTerms {
  lookupCode: string;
  supplierPositionId?: string;
  supplierFillId?: string;
  asset: Loan["borrowAsset"];
  railNetwork: BorrowAssetRailNetwork;
  expectedAmount: number;
  expectedToAddress: string;
  expectedFromAddress?: string;
  expectedTokenContract?: string;
  minConfirmations: number;
  minFinalityDepth?: number;
}

export type SupplierDisbursementVerificationStatus =
  | "valid"
  | "missing"
  | "amount_mismatch"
  | "destination_mismatch"
  | "asset_mismatch"
  | "token_contract_mismatch"
  | "unconfirmed"
  | "stale"
  | "reorged";

export type RepaymentVerificationStatus =
  | "valid_full_repayment"
  | "valid_partial_repayment"
  | "missing"
  | "amount_mismatch"
  | "destination_mismatch"
  | "asset_mismatch"
  | "token_contract_mismatch"
  | "unconfirmed"
  | "stale"
  | "reorged";

export interface SupplierDisbursementVerificationResult {
  status: SupplierDisbursementVerificationStatus;
  event: BorrowAssetWatcherEvent;
  detail: string;
  safeToProceed: boolean;
}

export interface RepaymentVerificationResult {
  status: RepaymentVerificationStatus;
  event: BorrowAssetWatcherEvent;
  detail: string;
  repaymentAmount: number;
  isFinalRepayment: boolean;
}

export interface BorrowAssetWatcherLifecycleAdapterResult {
  watcherEvent: BorrowAssetWatcherEvent;
  lifecycleEvent: HeadlessLifecycleEvent;
  verifierStatus: SupplierDisbursementVerificationStatus | RepaymentVerificationStatus;
  affectedArea: "supplierDisbursement" | "repaymentDetection";
}

export function createFixtureBorrowAssetWatcherEvent(input: Omit<BorrowAssetWatcherEvent, "id" | "observedAt" | "source" | "riskStatus" | "safetyAuditNote"> & Partial<Pick<BorrowAssetWatcherEvent, "id" | "observedAt" | "source" | "riskStatus" | "safetyAuditNote">>): BorrowAssetWatcherEvent {
  const observedAt = input.observedAt ?? new Date().toISOString();
  return {
    ...input,
    id: input.id ?? createBorrowAssetWatcherEventId(input.kind, input.lookupCode, input.asset, observedAt),
    observedAt,
    source: input.source ?? "fixture",
    riskStatus: input.riskStatus ?? "normal",
    safetyAuditNote: input.safetyAuditNote ?? "Fixture borrow-asset watcher event. No live Bitcoin/EVM node call, signing, broadcast, or fund movement occurred.",
  };
}

function createBorrowAssetWatcherEventId(
  kind: BorrowAssetWatcherEventKind,
  lookupCode: string,
  asset: Loan["borrowAsset"],
  observedAt: string,
): string {
  const compactLookup = lookupCode.replace(/[^a-zA-Z0-9]/g, "").slice(-12).toLowerCase();
  const compactTime = observedAt.replace(/[^0-9]/g, "").slice(0, 14);
  return `borrowwatch-${compactTime}-${compactLookup}-${asset.toLowerCase()}-${kind}`;
}
