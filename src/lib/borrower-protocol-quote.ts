import { createLoanQuote } from "./protocol/loan-quotes";
import { createLoanFundingState, type LoanRequest } from "./protocol/loan-requests";
import { calculatePlatformFeeBreakdown, DEFAULT_PLATFORM_FEE_CONFIG } from "./protocol/platform-fees";
import {
  allocateSupplierOffersToBorrowerRequest,
  createSupplierFillsFromDemoAllocation,
  getDemoSupplierOffers,
  type DemoSupplierOffer,
} from "./supplier-demo-data";
import type { Loan } from "./types";

export interface BorrowerSupplierFillSummary {
  fillId: string;
  supplierId: string;
  supplierOfferId: string;
  borrowAsset: Loan["borrowAsset"];
  amount: number;
  aprBps: number;
  fundingShareBps: number;
  status: string;
}

export interface BorrowerProtocolQuoteSummary {
  loanRequestId: string;
  fundingStatus: string;
  fundingProgressBps: number;
  activationEligible: boolean;
  weightedSupplierAprBps: number;
  borrowerAprBps: number;
  platformFeeRateBps: number;
  totalPlatformFeeDcr: number;
  platformFeeDcr: number;
  arbiterReserveDcr: number;
  collateralRequiredWithFeeDcr: number;
  supplierFillCount: number;
  supplierFilledAmount: number;
  supplierRemainingAmount: number;
  activeSupplierCapacity: number;
  supplierFills: BorrowerSupplierFillSummary[];
  nextBuildStep: string;
  notes: string[];
}

export function createBorrowerProtocolQuoteSummary(input: {
  collateralDcr: number;
  borrowAmount: number;
  borrowAsset: Loan["borrowAsset"];
  durationDays?: number;
  offers?: DemoSupplierOffer[];
}): BorrowerProtocolQuoteSummary {
  const durationDays = input.durationDays ?? 30;
  const loanRequest: LoanRequest = {
    id: "borrower-demo-quote",
    borrowerId: "borrower-demo",
    borrowAsset: input.borrowAsset,
    borrowAmount: input.borrowAmount,
    collateralAsset: "DCR",
    collateralAmount: input.collateralDcr,
    durationDays,
    requiredFundingThresholdBps: 10_000,
    createdAt: "2026-06-10T12:00:00.000Z",
    fundingDeadline: "2026-06-11T12:00:00.000Z",
    borrowerAcceptedPartialFunding: false,
  };
  const allocation = allocateSupplierOffersToBorrowerRequest({
    borrowAsset: input.borrowAsset,
    requestedAmount: input.borrowAmount,
    durationDays,
    offers: input.offers ?? getDemoSupplierOffers(),
  });
  const fills = createSupplierFillsFromDemoAllocation({
    loanRequestId: loanRequest.id,
    allocation,
    reservedAt: "2026-06-10T12:01:00.000Z",
  });

  if (fills.length === 0) {
    const fundingState = createLoanFundingState(loanRequest, fills);
    const platformFee = calculatePlatformFeeBreakdown(loanRequest.collateralAmount);

    return {
      loanRequestId: loanRequest.id,
      fundingStatus: allocation.status,
      fundingProgressBps: fundingState.fundingProgressBps,
      activationEligible: false,
      weightedSupplierAprBps: 0,
      borrowerAprBps: 0,
      platformFeeRateBps: DEFAULT_PLATFORM_FEE_CONFIG.platformFeeBps,
      totalPlatformFeeDcr: platformFee.totalFeeAmount,
      platformFeeDcr: platformFee.platformAmount,
      arbiterReserveDcr: platformFee.arbiterReserveAmount,
      collateralRequiredWithFeeDcr: loanRequest.collateralAmount + platformFee.totalFeeAmount,
      supplierFillCount: 0,
      supplierFilledAmount: fundingState.filledAmount,
      supplierRemainingAmount: allocation.remainingAmount,
      activeSupplierCapacity: allocation.activeCapacity,
      supplierFills: [],
      nextBuildStep: "Add active matching supplier offers before borrower collateral lock.",
      notes: [
        "No active supplier offers can currently fill this quote.",
        "Borrower collateral lock remains blocked until supplier liquidity is available.",
        "The 1% DCR platform fee is shown for planning, but should not be charged until funding is ready.",
      ],
    };
  }

  const quote = createLoanQuote({
    request: loanRequest,
    fills,
    interestRateConfig: {
      borrowAsset: input.borrowAsset,
      minimumAprBps: 500,
      maximumAprBps: 2500,
      protocolSpreadBps: 100,
      durationPremiumBps: durationDays > 30 ? 25 : 0,
      collateralRiskPremiumBps: input.collateralDcr > 0 ? 50 : 100,
    },
  });

  return {
    loanRequestId: quote.loanRequestId,
    fundingStatus: allocation.status,
    fundingProgressBps: quote.fundingState.fundingProgressBps,
    activationEligible: quote.activationEligible,
    weightedSupplierAprBps: quote.interestRateQuote.weightedSupplierAprBps,
    borrowerAprBps: quote.interestRateQuote.borrowerAprBps,
    platformFeeRateBps: DEFAULT_PLATFORM_FEE_CONFIG.platformFeeBps,
    totalPlatformFeeDcr: quote.platformFee.totalFeeAmount,
    platformFeeDcr: quote.platformFee.platformAmount,
    arbiterReserveDcr: quote.platformFee.arbiterReserveAmount,
    collateralRequiredWithFeeDcr: quote.collateralRequiredWithFee,
    supplierFillCount: quote.supplierAllocations.length,
    supplierFilledAmount: quote.fundingState.filledAmount,
    supplierRemainingAmount: allocation.remainingAmount,
    activeSupplierCapacity: allocation.activeCapacity,
    supplierFills: quote.supplierAllocations.map((allocationRow) => ({
      fillId: allocationRow.fillId,
      supplierId: allocationRow.supplierId,
      supplierOfferId: allocationRow.supplierOfferId,
      borrowAsset: input.borrowAsset,
      amount: allocationRow.filledAmount,
      aprBps: allocationRow.aprBps,
      fundingShareBps: allocationRow.fundingShareBps,
      status: fills.find((fill) => fill.id === allocationRow.fillId)?.status ?? "reserved",
    })),
    nextBuildStep: "Create supplier positions from these fills, then preview repayment allocation.",
    notes: [
      "Borrower supplier fills now come from active demo supplier offers.",
      "Paused, canceled, mismatched-asset, and over-duration offers are excluded from quote funding.",
      "The 1% DCR platform fee is included in required collateral.",
    ],
  };
}
