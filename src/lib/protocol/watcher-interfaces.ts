import type { BorrowAsset, CollateralAsset } from "./assets";
import type { PlatformFeeBreakdown } from "./platform-fees";

export type WatcherNetwork = "decred_simnet" | "decred_testnet" | "decred_mainnet" | "bitcoin_testnet" | "bitcoin_mainnet" | "evm_testnet" | "evm_mainnet";
export type WatcherStatus = "pending" | "observed" | "confirmed" | "stale" | "reorged" | "rejected";
export type SettlementDirection = "collateral_lock" | "supplier_disbursement" | "borrower_repayment" | "collateral_release" | "liquidation_review";

export interface WatcherConfirmationPolicy {
  requiredConfirmations: number;
  staleAfterBlocks: number;
  allowMainnet: boolean;
}

export interface ChainTransactionReference {
  network: WatcherNetwork;
  txid: string;
  blockHash?: string;
  blockHeight?: number;
  confirmations: number;
  observedAt: string;
}

export interface WatcherObservationBase {
  id: string;
  loanId: string;
  direction: SettlementDirection;
  status: WatcherStatus;
  reference?: ChainTransactionReference;
  requiredConfirmations: number;
  warnings: string[];
  blockers: string[];
  observedAt: string;
}

export interface DecredCollateralLockExpectation {
  loanId: string;
  collateralAsset: CollateralAsset;
  collateralAmount: number;
  escrowAddress: string;
  platformFee: PlatformFeeBreakdown;
  platformFeeAddress: string;
  arbiterReserveAddress?: string;
}

export interface DecredCollateralLockObservation extends WatcherObservationBase {
  direction: "collateral_lock";
  collateralAsset: CollateralAsset;
  collateralOutputFound: boolean;
  collateralAmount: number;
  escrowAddress: string;
  platformFeeOutputFound: boolean;
  platformFeeAmount: number;
  platformFeeAddress: string;
}

export interface BorrowAssetDisbursementExpectation {
  loanId: string;
  borrowAsset: BorrowAsset;
  supplierId: string;
  expectedAmount: number;
  borrowerReceiveAddress: string;
}

export interface BtcDisbursementObservation extends WatcherObservationBase {
  direction: "supplier_disbursement";
  borrowAsset: "BTC";
  supplierId: string;
  amount: number;
  borrowerReceiveAddress: string;
  outputFound: boolean;
}

export interface EvmTokenDisbursementObservation extends WatcherObservationBase {
  direction: "supplier_disbursement";
  borrowAsset: "USDC" | "USDT";
  supplierId: string;
  amount: number;
  tokenContractAddress: string;
  borrowerReceiveAddress: string;
  transferLogFound: boolean;
}

export type BorrowAssetDisbursementObservation = BtcDisbursementObservation | EvmTokenDisbursementObservation;

export function evaluateObservationStatus(input: {
  confirmations: number;
  requiredConfirmations: number;
  blockers?: string[];
  stale?: boolean;
  reorged?: boolean;
}): WatcherStatus {
  if (input.reorged) {
    return "reorged";
  }

  if ((input.blockers ?? []).length > 0) {
    return "rejected";
  }

  if (input.stale) {
    return "stale";
  }

  if (input.confirmations >= input.requiredConfirmations) {
    return "confirmed";
  }

  if (input.confirmations > 0) {
    return "observed";
  }

  return "pending";
}

export function createDecredCollateralLockObservation(input: {
  id: string;
  expectation: DecredCollateralLockExpectation;
  reference?: ChainTransactionReference;
  policy: WatcherConfirmationPolicy;
  collateralOutputFound: boolean;
  collateralAmount: number;
  escrowAddress: string;
  platformFeeOutputFound: boolean;
  platformFeeAmount: number;
  platformFeeAddress: string;
  observedAt: string;
}): DecredCollateralLockObservation {
  const blockers = collateralLockBlockers(input);
  const confirmations = input.reference?.confirmations ?? 0;

  return {
    id: input.id,
    loanId: input.expectation.loanId,
    direction: "collateral_lock",
    status: evaluateObservationStatus({
      confirmations,
      requiredConfirmations: input.policy.requiredConfirmations,
      blockers,
    }),
    reference: input.reference,
    requiredConfirmations: input.policy.requiredConfirmations,
    warnings: [],
    blockers,
    observedAt: input.observedAt,
    collateralAsset: input.expectation.collateralAsset,
    collateralOutputFound: input.collateralOutputFound,
    collateralAmount: input.collateralAmount,
    escrowAddress: input.escrowAddress,
    platformFeeOutputFound: input.platformFeeOutputFound,
    platformFeeAmount: input.platformFeeAmount,
    platformFeeAddress: input.platformFeeAddress,
  };
}

export function createBorrowAssetDisbursementObservation(input: {
  id: string;
  expectation: BorrowAssetDisbursementExpectation;
  reference?: ChainTransactionReference;
  policy: WatcherConfirmationPolicy;
  amount: number;
  borrowerReceiveAddress: string;
  observedAt: string;
  tokenContractAddress?: string;
  transferLogFound?: boolean;
  outputFound?: boolean;
}): BorrowAssetDisbursementObservation {
  if (input.expectation.borrowAsset === "BTC") {
    return createBtcDisbursementObservation(input as BtcDisbursementInput);
  }

  return createEvmTokenDisbursementObservation(input as EvmTokenDisbursementInput);
}

function createBtcDisbursementObservation(input: BtcDisbursementInput): BtcDisbursementObservation {
  const blockers = disbursementBlockers({
    expectedAmount: input.expectation.expectedAmount,
    expectedAddress: input.expectation.borrowerReceiveAddress,
    amount: input.amount,
    address: input.borrowerReceiveAddress,
    outputFound: input.outputFound ?? false,
  });
  const confirmations = input.reference?.confirmations ?? 0;

  return {
    id: input.id,
    loanId: input.expectation.loanId,
    direction: "supplier_disbursement",
    status: evaluateObservationStatus({
      confirmations,
      requiredConfirmations: input.policy.requiredConfirmations,
      blockers,
    }),
    reference: input.reference,
    requiredConfirmations: input.policy.requiredConfirmations,
    warnings: [],
    blockers,
    observedAt: input.observedAt,
    borrowAsset: "BTC",
    supplierId: input.expectation.supplierId,
    amount: input.amount,
    borrowerReceiveAddress: input.borrowerReceiveAddress,
    outputFound: input.outputFound ?? false,
  };
}

function createEvmTokenDisbursementObservation(input: EvmTokenDisbursementInput): EvmTokenDisbursementObservation {
  const blockers = disbursementBlockers({
    expectedAmount: input.expectation.expectedAmount,
    expectedAddress: input.expectation.borrowerReceiveAddress,
    amount: input.amount,
    address: input.borrowerReceiveAddress,
    outputFound: input.transferLogFound ?? false,
  });
  const confirmations = input.reference?.confirmations ?? 0;

  return {
    id: input.id,
    loanId: input.expectation.loanId,
    direction: "supplier_disbursement",
    status: evaluateObservationStatus({
      confirmations,
      requiredConfirmations: input.policy.requiredConfirmations,
      blockers,
    }),
    reference: input.reference,
    requiredConfirmations: input.policy.requiredConfirmations,
    warnings: [],
    blockers,
    observedAt: input.observedAt,
    borrowAsset: input.expectation.borrowAsset,
    supplierId: input.expectation.supplierId,
    amount: input.amount,
    borrowerReceiveAddress: input.borrowerReceiveAddress,
    tokenContractAddress: input.tokenContractAddress ?? "",
    transferLogFound: input.transferLogFound ?? false,
  };
}

function collateralLockBlockers(input: {
  expectation: DecredCollateralLockExpectation;
  collateralOutputFound: boolean;
  collateralAmount: number;
  escrowAddress: string;
  platformFeeOutputFound: boolean;
  platformFeeAmount: number;
  platformFeeAddress: string;
}): string[] {
  const blockers: string[] = [];

  if (input.expectation.collateralAsset !== "DCR") {
    blockers.push("Only DCR collateral is supported.");
  }

  if (!input.collateralOutputFound) {
    blockers.push("Collateral output was not found.");
  }

  if (input.collateralAmount !== input.expectation.collateralAmount) {
    blockers.push("Collateral amount does not match expectation.");
  }

  if (input.escrowAddress !== input.expectation.escrowAddress) {
    blockers.push("Collateral escrow address does not match expectation.");
  }

  if (!input.platformFeeOutputFound) {
    blockers.push("Platform fee output was not found.");
  }

  if (input.platformFeeAmount !== input.expectation.platformFee.totalFeeAmount) {
    blockers.push("Platform fee amount does not match expectation.");
  }

  if (input.platformFeeAddress !== input.expectation.platformFeeAddress) {
    blockers.push("Platform fee address does not match expectation.");
  }

  return blockers;
}

function disbursementBlockers(input: {
  expectedAmount: number;
  expectedAddress: string;
  amount: number;
  address: string;
  outputFound: boolean;
}): string[] {
  const blockers: string[] = [];

  if (!input.outputFound) {
    blockers.push("Disbursement output or transfer log was not found.");
  }

  if (input.amount !== input.expectedAmount) {
    blockers.push("Disbursement amount does not match expectation.");
  }

  if (input.address !== input.expectedAddress) {
    blockers.push("Borrower receive address does not match expectation.");
  }

  return blockers;
}

type BtcDisbursementInput = Parameters<typeof createBorrowAssetDisbursementObservation>[0] & {
  expectation: BorrowAssetDisbursementExpectation & { borrowAsset: "BTC" };
};

type EvmTokenDisbursementInput = Parameters<typeof createBorrowAssetDisbursementObservation>[0] & {
  expectation: BorrowAssetDisbursementExpectation & { borrowAsset: "USDC" | "USDT" };
};
