import { calculateBorrowerAprQuote, type InterestRateConfig, type InterestRateQuote } from "./interest-rates";
import { createLoanFundingState, type LoanFundingState, type LoanRequest } from "./loan-requests";
import {
  calculatePlatformFeeBreakdown,
  DEFAULT_PLATFORM_FEE_CONFIG,
  type PlatformFeeBreakdown,
  type PlatformFeeConfig,
} from "./platform-fees";
import { calculateSimpleInterest, type SupplierFill } from "./supplier-offers";

export interface SupplierQuoteAllocation {
  supplierId: string;
  supplierOfferId: string;
  fillId: string;
  filledAmount: number;
  aprBps: number;
  principalDue: number;
  interestDue: number;
  totalDue: number;
  fundingShareBps: number;
}

export interface LoanQuote {
  loanRequestId: string;
  fundingState: LoanFundingState;
  interestRateQuote: InterestRateQuote;
  platformFee: PlatformFeeBreakdown;
  supplierAllocations: SupplierQuoteAllocation[];
  borrowerPrincipalDue: number;
  borrowerInterestDue: number;
  borrowerTotalDue: number;
  collateralRequiredWithFee: number;
  activationEligible: boolean;
}

export interface LoanQuoteInput {
  request: LoanRequest;
  fills: SupplierFill[];
  interestRateConfig: InterestRateConfig;
  platformFeeConfig?: PlatformFeeConfig;
  now?: string;
}

export function createLoanQuote(input: LoanQuoteInput): LoanQuote {
  const fundingState = createLoanFundingState(input.request, input.fills, input.now);
  const interestRateQuote = calculateBorrowerAprQuote(input.fills, input.interestRateConfig);
  const platformFee = calculatePlatformFeeBreakdown(
    input.request.collateralAmount,
    input.platformFeeConfig ?? DEFAULT_PLATFORM_FEE_CONFIG,
  );
  const supplierAllocations = createSupplierQuoteAllocations(input.request, input.fills);
  const borrowerInterestDue = calculateSimpleInterest(
    fundingState.filledAmount,
    interestRateQuote.borrowerAprBps,
    input.request.durationDays,
  );

  return {
    loanRequestId: input.request.id,
    fundingState,
    interestRateQuote,
    platformFee,
    supplierAllocations,
    borrowerPrincipalDue: fundingState.filledAmount,
    borrowerInterestDue,
    borrowerTotalDue: fundingState.filledAmount + borrowerInterestDue,
    collateralRequiredWithFee: input.request.collateralAmount + platformFee.totalFeeAmount,
    activationEligible: fundingState.activationEligible,
  };
}

export function createSupplierQuoteAllocations(
  request: LoanRequest,
  fills: SupplierFill[],
): SupplierQuoteAllocation[] {
  const fundingState = createLoanFundingState(request, fills);

  if (fundingState.filledAmount <= 0) {
    return [];
  }

  return fills.map((fill) => {
    const interestDue = calculateSimpleInterest(fill.amount, fill.aprBps, request.durationDays);

    return {
      supplierId: fill.supplierId,
      supplierOfferId: fill.supplierOfferId,
      fillId: fill.id,
      filledAmount: fill.amount,
      aprBps: fill.aprBps,
      principalDue: fill.amount,
      interestDue,
      totalDue: fill.amount + interestDue,
      fundingShareBps: (fill.amount / fundingState.filledAmount) * 10_000,
    };
  });
}
