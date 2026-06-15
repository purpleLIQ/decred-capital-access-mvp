import { createBorrowerProtocolQuoteSummary, type BorrowerProtocolQuoteSummary } from "./borrower-protocol-quote";
import type { Loan } from "./types";
import { allocateRepaymentAcrossSupplierPositions, type SupplierRepaymentAllocationPreview } from "./supplier-repayment-allocation";
import {
  createSupplierPositionPreviewsFromAcceptedQuote,
  type SupplierPositionPreviewResult,
} from "./supplier-position-previews";
import type { DemoSupplierOffer } from "./supplier-demo-data";

export type DemoLoanLifecycleStage =
  | "quote_requested"
  | "liquidity_reserved"
  | "positions_previewed"
  | "repayment_previewed";

export interface DemoBorrowerQuoteLifecycleInput {
  borrowerId: string;
  borrowerLoanRef: string;
  loanId: string;
  collateralDcr: number;
  borrowAmount: number;
  borrowAsset: Loan["borrowAsset"];
  durationDays: number;
  borrowerAcceptedPartialFunding: boolean;
  repaymentAmount: number;
  offers: DemoSupplierOffer[];
}

export interface DemoLoanLifecycleState {
  borrowerId: string;
  borrowerLoanRef: string;
  loanId: string;
  stage: DemoLoanLifecycleStage;
  quote: BorrowerProtocolQuoteSummary;
  supplierPositions: SupplierPositionPreviewResult;
  repaymentAllocation: SupplierRepaymentAllocationPreview;
  adapterBoundaries: string[];
  nextIntegrationSteps: string[];
}

export function createDemoLoanLifecycleState(input: DemoBorrowerQuoteLifecycleInput): DemoLoanLifecycleState {
  const quote = createBorrowerProtocolQuoteSummary({
    collateralDcr: input.collateralDcr,
    borrowAmount: input.borrowAmount,
    borrowAsset: input.borrowAsset,
    durationDays: input.durationDays,
    offers: input.offers,
  });
  const supplierPositions = createSupplierPositionPreviewsFromAcceptedQuote({
    quote,
    loanId: input.loanId,
    borrowerId: input.borrowerId,
    borrowerLoanRef: input.borrowerLoanRef,
    durationDays: input.durationDays,
    borrowerAcceptedPartialFunding: input.borrowerAcceptedPartialFunding,
  });
  const repaymentAllocation = allocateRepaymentAcrossSupplierPositions({
    positions: supplierPositions.positions,
    repaymentAmount: input.repaymentAmount,
  });

  return {
    borrowerId: input.borrowerId,
    borrowerLoanRef: input.borrowerLoanRef,
    loanId: input.loanId,
    stage: resolveLifecycleStage({ quote, supplierPositions, repaymentAllocation }),
    quote,
    supplierPositions,
    repaymentAllocation,
    adapterBoundaries: [
      "Supplier offer source is still demo-backed and can later be replaced by persistent supplier account state.",
      "Borrower quote acceptance is an explicit adapter input and can later come from borrower account state or wallet events.",
      "Repayment amount is a deterministic preview input and can later come from chain watcher events.",
    ],
    nextIntegrationSteps: [
      "Persist accepted quote, supplier fills, and supplier positions as lifecycle records.",
      "Replace repayment preview amount with watched repayment outputs once transaction detection exists.",
      "Keep wallet signing, broadcast, collateral release, and liquidation execution outside this adapter until those boundaries are reviewed.",
    ],
  };
}

function resolveLifecycleStage(input: {
  quote: BorrowerProtocolQuoteSummary;
  supplierPositions: SupplierPositionPreviewResult;
  repaymentAllocation: SupplierRepaymentAllocationPreview;
}): DemoLoanLifecycleStage {
  if (input.repaymentAllocation.allocations.length > 0) return "repayment_previewed";
  if (input.supplierPositions.positions.length > 0) return "positions_previewed";
  if (input.quote.supplierFillCount > 0) return "liquidity_reserved";
  return "quote_requested";
}
