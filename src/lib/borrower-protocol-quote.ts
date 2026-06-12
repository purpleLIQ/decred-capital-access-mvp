import { createLoanQuote } from "./protocol/loan-quotes";
import type { LoanRequest } from "./protocol/loan-requests";
import type { SupplierFill } from "./protocol/supplier-offers";
import { protocolConfig } from "./protocol-config";
import type { Loan } from "./types";

export interface BorrowerProtocolQuoteSummary {
  loanRequestId: string;
  fundingStatus: string;
  fundingProgressBps: number;
  activationEligible: boolean;
  weightedSupplierAprBps: number;
  borrowerAprBps: number;
  platformFeeDcr: number;
  arbiterReserveDcr: number;
  collateralRequiredWithFeeDcr: number;
  supplierFillCount: number;
  supplierFilledAmount: number;
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
  const fill: SupplierFill = {
    id: "borrower-demo-fill-1",
    loanRequestId: loanRequest.id,
    supplierOfferId: "borrower-demo-offer-1",
    supplierId: "supplier-demo-1",
    borrowAsset: input.borrowAsset,
    amount: input.borrowAmount,
    aprBps: protocolConfig.estimatedAprBps,
    status: "reserved",
    reservedAt: "2026-06-10T12:01:00.000Z",
  };
  const quote = createLoanQuote({
    request: loanRequest,
    fills: [fill],
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
    platformFeeDcr: quote.platformFee.platformFeeAmount,
    arbiterReserveDcr: quote.platformFee.arbiterReserveAmount,
    collateralRequiredWithFeeDcr: quote.collateralRequiredWithFee,
    supplierFillCount: quote.supplierAllocations.length,
    supplierFilledAmount: quote.fundingState.filledAmount,
    nextBuildStep: "Connect supplier offers and partial-fill progress to this borrower quote flow.",
    notes: [
      "Protocol quote math is attached to the borrower-facing demo quote.",
      "Supplier fill data is still deterministic demo data.",
      "Next product step is supplier fill visibility and supplier offer UX.",
    ],
  };
}
