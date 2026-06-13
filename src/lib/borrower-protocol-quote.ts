import { createLoanQuote } from "./protocol/loan-quotes";
import type { LoanRequest } from "./protocol/loan-requests";
import { DEFAULT_PLATFORM_FEE_CONFIG } from "./protocol/platform-fees";
import type { SupplierFill } from "./protocol/supplier-offers";
import { protocolConfig } from "./protocol-config";
import type { Loan } from "./types";

export interface BorrowerSupplierFillSummary {
  fillId: string;
  supplierId: string;
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
  supplierFills: BorrowerSupplierFillSummary[];
  nextBuildStep: string;
  notes: string[];
}

export function createBorrowerProtocolQuoteSummary(input: {
  collateralDcr: number;
  borrowAmount: number;
  borrowAsset: Loan["borrowAsset"];
  durationDays?: number;
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
  const fills: SupplierFill[] = [
    {
      id: "borrower-demo-fill-1",
      loanRequestId: loanRequest.id,
      supplierOfferId: "borrower-demo-offer-1",
      supplierId: "supplier-demo-1",
      borrowAsset: input.borrowAsset,
      amount: Number((input.borrowAmount * 0.65).toFixed(8)),
      aprBps: protocolConfig.estimatedAprBps,
      status: "reserved",
      reservedAt: "2026-06-10T12:01:00.000Z",
    },
    {
      id: "borrower-demo-fill-2",
      loanRequestId: loanRequest.id,
      supplierOfferId: "borrower-demo-offer-2",
      supplierId: "supplier-demo-2",
      borrowAsset: input.borrowAsset,
      amount: Number((input.borrowAmount * 0.35).toFixed(8)),
      aprBps: protocolConfig.estimatedAprBps + 75,
      status: "reserved",
      reservedAt: "2026-06-10T12:03:00.000Z",
    },
  ];
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
    fundingStatus: quote.fundingState.status,
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
    supplierFills: quote.supplierAllocations.map((allocation) => ({
      fillId: allocation.fillId,
      supplierId: allocation.supplierId,
      amount: allocation.filledAmount,
      aprBps: allocation.aprBps,
      fundingShareBps: allocation.fundingShareBps,
      status: fills.find((fill) => fill.id === allocation.fillId)?.status ?? "reserved",
    })),
    nextBuildStep: "Connect live supplier offers and partial-fill progress to this borrower quote flow.",
    notes: [
      "Protocol quote math is attached to the borrower-facing demo quote.",
      "The 1% DCR platform fee is included in required collateral.",
      "Next product step is supplier offer creation and supplier position visibility.",
    ],
  };
}
