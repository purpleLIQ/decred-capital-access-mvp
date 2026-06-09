import type { BorrowAsset, CollateralAsset } from "./assets";
import type { SupplierFill, SupplierPosition } from "./supplier-offers";
import { createSupplierPositionFromFill, validateSupplierFill } from "./supplier-offers";

export type LoanFundingStatus = "open" | "partially_filled" | "funded" | "expired" | "cancelled";

export interface LoanRequest {
  id: string;
  borrowerId: string;
  borrowAsset: BorrowAsset;
  borrowAmount: number;
  collateralAsset: CollateralAsset;
  collateralAmount: number;
  durationDays: number;
  requiredFundingThresholdBps: number;
  createdAt: string;
  fundingDeadline: string;
  borrowerAcceptedPartialFunding: boolean;
}

export interface LoanFundingState {
  loanRequestId: string;
  borrowAsset: BorrowAsset;
  requestedAmount: number;
  filledAmount: number;
  remainingAmount: number;
  fundingProgressBps: number;
  requiredFundingThresholdBps: number;
  status: LoanFundingStatus;
  activationEligible: boolean;
  fills: SupplierFill[];
}

export interface FundingTransitionResult {
  state: LoanFundingState;
  acceptedFill: SupplierFill;
}

export function createLoanFundingState(
  request: LoanRequest,
  fills: SupplierFill[] = [],
  now?: string,
): LoanFundingState {
  validateLoanRequest(request);

  for (const fill of fills) {
    validateSupplierFill(fill, request.borrowAsset);
  }

  const filledAmount = fills.reduce((sum, fill) => sum + fill.amount, 0);
  const cappedFilledAmount = Math.min(filledAmount, request.borrowAmount);
  const remainingAmount = Math.max(request.borrowAmount - filledAmount, 0);
  const fundingProgressBps = (cappedFilledAmount / request.borrowAmount) * 10_000;
  const expired = Boolean(now && Date.parse(request.fundingDeadline) <= Date.parse(now));
  const activationEligible = !expired && fundingProgressBps >= request.requiredFundingThresholdBps;

  return {
    loanRequestId: request.id,
    borrowAsset: request.borrowAsset,
    requestedAmount: request.borrowAmount,
    filledAmount,
    remainingAmount,
    fundingProgressBps,
    requiredFundingThresholdBps: request.requiredFundingThresholdBps,
    status: resolveFundingStatus({
      fundingProgressBps,
      requiredFundingThresholdBps: request.requiredFundingThresholdBps,
      expired,
    }),
    activationEligible,
    fills,
  };
}

export function canActivateLoanFunding(state: LoanFundingState): boolean {
  return state.activationEligible && state.status === "funded";
}

export function canBorrowerAcceptPartialFunding(request: LoanRequest, state: LoanFundingState): boolean {
  return (
    request.borrowerAcceptedPartialFunding &&
    state.status === "partially_filled" &&
    state.filledAmount > 0 &&
    state.fundingProgressBps < request.requiredFundingThresholdBps
  );
}

export function addSupplierFillToFundingState(input: {
  request: LoanRequest;
  currentFills: SupplierFill[];
  fill: SupplierFill;
  now?: string;
}): FundingTransitionResult {
  const currentState = createLoanFundingState(input.request, input.currentFills, input.now);

  if (currentState.status === "expired") {
    throw new Error("Cannot add supplier fills after the funding deadline.");
  }

  if (currentState.status === "funded") {
    throw new Error("Cannot add supplier fills after the request is fully funded.");
  }

  validateSupplierFill(input.fill, input.request.borrowAsset);

  if (input.fill.loanRequestId !== input.request.id) {
    throw new Error("Supplier fill loan request id must match the loan request.");
  }

  if (input.fill.amount > currentState.remainingAmount) {
    throw new Error("Supplier fill exceeds the remaining loan request amount.");
  }

  return {
    acceptedFill: input.fill,
    state: createLoanFundingState(input.request, [...input.currentFills, input.fill], input.now),
  };
}

export function expireLoanFundingState(request: LoanRequest, fills: SupplierFill[], now: string): LoanFundingState {
  return createLoanFundingState(request, fills, now);
}

export function createSupplierPositionsForLoan(input: {
  loanId: string;
  request: LoanRequest;
  fills: SupplierFill[];
  startAt: string;
  repaymentAddressBySupplierId: Record<string, string>;
}): SupplierPosition[] {
  const fundingState = createLoanFundingState(input.request, input.fills);

  if (!canActivateLoanFunding(fundingState)) {
    throw new Error("Supplier positions can only be created after the required funding threshold is met.");
  }

  return input.fills.map((fill) =>
    createSupplierPositionFromFill({
      fill,
      loanId: input.loanId,
      startAt: input.startAt,
      durationDays: input.request.durationDays,
      repaymentAddress: input.repaymentAddressBySupplierId[fill.supplierId] ?? "",
    }),
  );
}

function validateLoanRequest(request: LoanRequest): void {
  if (request.collateralAsset !== "DCR") {
    throw new Error("DCR is the only supported collateral asset for v0.");
  }

  if (request.borrowAmount <= 0 || request.collateralAmount <= 0) {
    throw new Error("Loan request amounts must be positive.");
  }

  if (request.durationDays <= 0) {
    throw new Error("Loan request duration must be positive.");
  }

  if (request.requiredFundingThresholdBps <= 0 || request.requiredFundingThresholdBps > 10_000) {
    throw new Error("Required funding threshold must be greater than 0 and no more than 10000 bps.");
  }
}

function resolveFundingStatus(input: {
  fundingProgressBps: number;
  requiredFundingThresholdBps: number;
  expired: boolean;
}): LoanFundingStatus {
  if (input.expired && input.fundingProgressBps < input.requiredFundingThresholdBps) {
    return "expired";
  }

  if (input.fundingProgressBps >= input.requiredFundingThresholdBps) {
    return "funded";
  }

  if (input.fundingProgressBps > 0) {
    return "partially_filled";
  }

  return input.expired ? "expired" : "open";
}
