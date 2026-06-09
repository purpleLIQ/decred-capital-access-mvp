import type { BorrowAsset } from "./assets";

export type SupplierOfferStatus = "open" | "reserved" | "filled" | "expired" | "cancelled";
export type SupplierFillStatus = "reserved" | "disbursed" | "repaid" | "defaulted";
export type SupplierPositionStatus = "pending_disbursement" | "active" | "repaid" | "defaulted";

export interface SupplierOffer {
  id: string;
  supplierId: string;
  borrowAsset: BorrowAsset;
  availableAmount: number;
  minFillAmount: number;
  minAprBps: number;
  maxDurationDays: number;
  minCollateralRatioBps: number;
  repaymentAddress: string;
  autoFill: boolean;
  status: SupplierOfferStatus;
  createdAt: string;
  expiresAt?: string;
}

export interface SupplierFill {
  id: string;
  loanRequestId: string;
  supplierOfferId: string;
  supplierId: string;
  borrowAsset: BorrowAsset;
  amount: number;
  aprBps: number;
  status: SupplierFillStatus;
  reservedAt: string;
}

export interface SupplierPosition {
  id: string;
  loanId: string;
  supplierId: string;
  borrowAsset: BorrowAsset;
  filledAmount: number;
  aprBps: number;
  startAt: string;
  durationDays: number;
  repaymentAddress: string;
  principalDue: number;
  interestDue: number;
  status: SupplierPositionStatus;
}

export function validateSupplierFill(fill: SupplierFill, requestedAsset: BorrowAsset): void {
  if (fill.borrowAsset !== requestedAsset) {
    throw new Error("Supplier fill asset must match the loan request asset.");
  }

  if (fill.amount <= 0) {
    throw new Error("Supplier fill amount must be positive.");
  }

  if (fill.aprBps < 0) {
    throw new Error("Supplier fill APR must be non-negative.");
  }
}

export function createSupplierPositionFromFill(input: {
  fill: SupplierFill;
  loanId: string;
  startAt: string;
  durationDays: number;
  repaymentAddress: string;
}): SupplierPosition {
  const interestDue = calculateSimpleInterest(input.fill.amount, input.fill.aprBps, input.durationDays);

  return {
    id: `position-${input.fill.id}`,
    loanId: input.loanId,
    supplierId: input.fill.supplierId,
    borrowAsset: input.fill.borrowAsset,
    filledAmount: input.fill.amount,
    aprBps: input.fill.aprBps,
    startAt: input.startAt,
    durationDays: input.durationDays,
    repaymentAddress: input.repaymentAddress,
    principalDue: input.fill.amount,
    interestDue,
    status: "active",
  };
}

export function calculateSimpleInterest(principal: number, aprBps: number, durationDays: number): number {
  if (principal < 0 || aprBps < 0 || durationDays < 0) {
    throw new Error("Principal, APR, and duration must be non-negative.");
  }

  return principal * (aprBps / 10_000) * (durationDays / 365);
}
