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

export interface SupplierOfferReservationRequest {
  offer: SupplierOffer;
  loanRequestId: string;
  requestedBorrowAsset: BorrowAsset;
  requestedAmount: number;
  remainingRequestAmount: number;
  existingOfferFills?: SupplierFill[];
  durationDays: number;
  collateralRatioBps: number;
  now: string;
  fillId: string;
}

export interface SupplierOfferReservationResult {
  offer: SupplierOffer;
  fill: SupplierFill;
  remainingOfferAmount: number;
  reservedAmount: number;
}

export interface SupplierOfferEligibility {
  eligible: boolean;
  reasons: string[];
  availableAmountAfterExistingFills: number;
  maximumReservableAmount: number;
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

export function evaluateSupplierOfferReservation(
  request: Omit<SupplierOfferReservationRequest, "fillId">,
): SupplierOfferEligibility {
  const reasons: string[] = [];
  const existingOfferFills = request.existingOfferFills ?? [];
  const alreadyReservedAmount = existingOfferFills
    .filter((fill) => fill.supplierOfferId === request.offer.id)
    .reduce((sum, fill) => sum + fill.amount, 0);
  const availableAmountAfterExistingFills = Math.max(request.offer.availableAmount - alreadyReservedAmount, 0);
  const maximumReservableAmount = Math.min(
    request.requestedAmount,
    request.remainingRequestAmount,
    availableAmountAfterExistingFills,
  );

  if (request.offer.status !== "open" && request.offer.status !== "reserved") {
    reasons.push("Supplier offer is not open for reservation.");
  }

  if (request.offer.expiresAt && Date.parse(request.offer.expiresAt) <= Date.parse(request.now)) {
    reasons.push("Supplier offer has expired.");
  }

  if (request.offer.borrowAsset !== request.requestedBorrowAsset) {
    reasons.push("Supplier offer asset does not match the loan request asset.");
  }

  if (request.durationDays > request.offer.maxDurationDays) {
    reasons.push("Loan duration exceeds the supplier offer maximum duration.");
  }

  if (request.collateralRatioBps < request.offer.minCollateralRatioBps) {
    reasons.push("Loan collateral ratio is below the supplier offer minimum.");
  }

  if (request.requestedAmount <= 0) {
    reasons.push("Requested fill amount must be positive.");
  }

  if (request.remainingRequestAmount <= 0) {
    reasons.push("Loan request is already fully reserved.");
  }

  if (availableAmountAfterExistingFills <= 0) {
    reasons.push("Supplier offer has no remaining available amount.");
  }

  if (maximumReservableAmount > 0 && maximumReservableAmount < request.offer.minFillAmount) {
    reasons.push("Reservable amount is below the supplier offer minimum fill amount.");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    availableAmountAfterExistingFills,
    maximumReservableAmount,
  };
}

export function reserveSupplierOfferFill(
  request: SupplierOfferReservationRequest,
): SupplierOfferReservationResult {
  const eligibility = evaluateSupplierOfferReservation(request);

  if (!eligibility.eligible) {
    throw new Error(eligibility.reasons.join(" "));
  }

  const reservedAmount = eligibility.maximumReservableAmount;
  const remainingOfferAmount = eligibility.availableAmountAfterExistingFills - reservedAmount;
  const fill: SupplierFill = {
    id: request.fillId,
    loanRequestId: request.loanRequestId,
    supplierOfferId: request.offer.id,
    supplierId: request.offer.supplierId,
    borrowAsset: request.offer.borrowAsset,
    amount: reservedAmount,
    aprBps: request.offer.minAprBps,
    status: "reserved",
    reservedAt: request.now,
  };

  return {
    offer: {
      ...request.offer,
      status: remainingOfferAmount > 0 ? "reserved" : "filled",
    },
    fill,
    remainingOfferAmount,
    reservedAmount,
  };
}

export function expireSupplierOffer(offer: SupplierOffer, now: string): SupplierOffer {
  if (offer.status === "filled" || offer.status === "cancelled") {
    return offer;
  }

  if (offer.expiresAt && Date.parse(offer.expiresAt) <= Date.parse(now)) {
    return {
      ...offer,
      status: "expired",
    };
  }

  return offer;
}

export function cancelSupplierOffer(offer: SupplierOffer): SupplierOffer {
  if (offer.status === "filled") {
    throw new Error("Filled supplier offers cannot be cancelled.");
  }

  return {
    ...offer,
    status: "cancelled",
  };
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
