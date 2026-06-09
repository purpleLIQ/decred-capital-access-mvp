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

export function createLoanFundingState(
  request: LoanRequest,
  fills: SupplierFill[] = [],
): LoanFundingState {
  if (request.collateralAsset !== "DCR") {
    throw new Error("DCR is the only supported collateral asset for v0.");
  }

  if (request.borrowAmount <= 0 || request.collateralAmount <= 0) {
    throw new Error("Loan request amounts must be positive.");
  }

  if (request.requiredFundingThresholdBps <= 0 || request.requiredFundingThresholdBps > 10_000) {
    throw new Error("Required funding threshold must be greater than 0 and no more than 10000 bps.");
  }

  for (const fill of fills) {
    validateSupplierFill(fill, request.borrowAsset);
  }

  const filledAmount = fills.reduce((sum, fill) => sum + fill.amount, 0);
  const cappedFilledAmount = Math.min(filledAmount, request.borrowAmount);
  const remainingAmount = Math.max(request.borrowAmount - filledAmount, 0);
  const fundingProgressBps = (cappedFilledAmount / request.borrowAmount) * 10_000;
  const activationEligible = fundingProgressBps >= request.requiredFundingThresholdBps;

  return {
    loanRequestId: request.id,
    borrowAsset: request.borrowAsset,
    requestedAmount: request.borrowAmount,
    filledAmount,
    remainingAmount,
    fundingProgressBps,
    requiredFundingThresholdBps: request.requiredFundingThresholdBps,
    status: resolveFundingStatus(fundingProgressBps, request.requiredFundingThresholdBps),
    activationEligible,
    fills,
  };
}

export function canActivateLoanFunding(state: LoanFundingState): boolean {
  return state.activationEligible && state.status === "funded";
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

function resolveFundingStatus(
  fundingProgressBps: number,
  requiredFundingThresholdBps: number,
): LoanFundingStatus {
  if (fundingProgressBps >= requiredFundingThresholdBps) {
    return "funded";
  }

  if (fundingProgressBps > 0) {
    return "partially_filled";
  }

  return "open";
}
