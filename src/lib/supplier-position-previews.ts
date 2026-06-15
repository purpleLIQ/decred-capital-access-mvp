import { createLoanFundingState, type LoanRequest } from "./protocol/loan-requests";
import { createSupplierPositionFromFill, type SupplierFill } from "./protocol/supplier-offers";
import type { BorrowerProtocolQuoteSummary } from "./borrower-protocol-quote";
import type { BorrowAsset } from "./protocol/assets";

export type SupplierPositionPreviewStatus = "waiting_for_liquidity" | "preview" | "awaiting_repayment";

export interface SupplierPositionPreview {
  id: string;
  supplierId: string;
  supplierOfferId: string;
  fillId: string;
  loanId: string;
  borrowerId: string;
  borrowerLoanRef: string;
  borrowAsset: BorrowAsset;
  principal: number;
  aprBps: number;
  interestDue: number;
  totalDue: number;
  repaymentReceived: number;
  remainingDue: number;
  repaymentAddress: string;
  status: SupplierPositionPreviewStatus;
}

export interface SupplierPositionPreviewResult {
  loanId: string;
  borrowerId: string;
  borrowerLoanRef: string;
  fundingStatus: string;
  activationEligible: boolean;
  borrowerAcceptedPartialFunding: boolean;
  acceptedFillCount: number;
  totalPrincipal: number;
  totalInterestDue: number;
  totalDue: number;
  repaymentReceived: number;
  remainingDue: number;
  status: "waiting_for_liquidity" | "ready_for_repayment_preview";
  positions: SupplierPositionPreview[];
  notes: string[];
}

const DEFAULT_START_AT = "2026-06-10T12:05:00.000Z";
const DEFAULT_REPAYMENT_RECEIVED = 0;

export function createSupplierPositionPreviewsFromAcceptedQuote(input: {
  quote: BorrowerProtocolQuoteSummary;
  loanRequest?: LoanRequest;
  fills?: SupplierFill[];
  loanId?: string;
  borrowerId?: string;
  borrowerLoanRef?: string;
  durationDays?: number;
  acceptedAt?: string;
  borrowerAcceptedPartialFunding?: boolean;
  repaymentAddressBySupplierId?: Record<string, string>;
}): SupplierPositionPreviewResult {
  const loanId = input.loanId ?? input.loanRequest?.id ?? input.quote.loanRequestId;
  const borrowerId = input.borrowerId ?? input.loanRequest?.borrowerId ?? "borrower-demo";
  const borrowerLoanRef = input.borrowerLoanRef ?? `loan-${loanId}`;
  const durationDays = input.durationDays ?? input.loanRequest?.durationDays ?? 30;
  const borrowerAcceptedPartialFunding = input.borrowerAcceptedPartialFunding ?? false;
  const activationEligible = canActivateSupplierPositionPreviews({
    fundingStatus: input.quote.fundingStatus,
    activationEligible: input.quote.activationEligible,
    borrowerAcceptedPartialFunding,
  });

  if (!activationEligible) {
    return {
      loanId,
      borrowerId,
      borrowerLoanRef,
      fundingStatus: input.quote.fundingStatus,
      activationEligible: false,
      borrowerAcceptedPartialFunding,
      acceptedFillCount: 0,
      totalPrincipal: 0,
      totalInterestDue: 0,
      totalDue: 0,
      repaymentReceived: 0,
      remainingDue: 0,
      status: "waiting_for_liquidity",
      positions: [],
      notes: buildWaitingNotes(input.quote.fundingStatus, input.quote.supplierFillCount, borrowerAcceptedPartialFunding),
    };
  }

  const fills = input.fills ?? createAcceptedSupplierFillsFromQuote(input.quote, loanId, input.acceptedAt ?? DEFAULT_START_AT);
  const fundingState = input.loanRequest ? createLoanFundingState(input.loanRequest, fills) : null;
  const acceptedFills = fundingState?.fills ?? fills;
  const positions = acceptedFills.map((fill) => {
    const repaymentAddress = input.repaymentAddressBySupplierId?.[fill.supplierId] ?? `demo-repay-${fill.supplierId}`;
    const protocolPosition = createSupplierPositionFromFill({
      fill,
      loanId,
      startAt: input.acceptedAt ?? DEFAULT_START_AT,
      durationDays,
      repaymentAddress,
    });
    const totalDue = protocolPosition.principalDue + protocolPosition.interestDue;

    return {
      id: protocolPosition.id,
      supplierId: protocolPosition.supplierId,
      supplierOfferId: fill.supplierOfferId,
      fillId: fill.id,
      loanId: protocolPosition.loanId,
      borrowerId,
      borrowerLoanRef,
      borrowAsset: protocolPosition.borrowAsset,
      principal: protocolPosition.principalDue,
      aprBps: protocolPosition.aprBps,
      interestDue: protocolPosition.interestDue,
      totalDue,
      repaymentReceived: DEFAULT_REPAYMENT_RECEIVED,
      remainingDue: totalDue,
      repaymentAddress,
      status: "preview" as const,
    };
  });
  const totalPrincipal = roundAssetAmount(positions.reduce((total, position) => total + position.principal, 0));
  const totalInterestDue = roundAssetAmount(positions.reduce((total, position) => total + position.interestDue, 0));
  const totalDue = roundAssetAmount(positions.reduce((total, position) => total + position.totalDue, 0));

  return {
    loanId,
    borrowerId,
    borrowerLoanRef,
    fundingStatus: input.quote.fundingStatus,
    activationEligible: true,
    borrowerAcceptedPartialFunding,
    acceptedFillCount: acceptedFills.length,
    totalPrincipal,
    totalInterestDue,
    totalDue,
    repaymentReceived: DEFAULT_REPAYMENT_RECEIVED,
    remainingDue: totalDue,
    status: "ready_for_repayment_preview",
    positions,
    notes: [
      "Accepted borrower quote fills become supplier position previews.",
      "Each supplier earns interest only on its own filled amount.",
      "Repayment fields are shaped for deterministic pro-rata allocation in the next PR.",
    ],
  };
}

export function createAcceptedSupplierFillsFromQuote(
  quote: BorrowerProtocolQuoteSummary,
  loanRequestId: string = quote.loanRequestId,
  reservedAt: string = DEFAULT_START_AT,
): SupplierFill[] {
  return quote.supplierFills.map((fill) => ({
    id: fill.fillId,
    loanRequestId,
    supplierOfferId: fill.supplierOfferId,
    supplierId: fill.supplierId,
    borrowAsset: fill.borrowAsset,
    amount: fill.amount,
    aprBps: fill.aprBps,
    status: "reserved",
    reservedAt,
  }));
}

function canActivateSupplierPositionPreviews(input: {
  fundingStatus: string;
  activationEligible: boolean;
  borrowerAcceptedPartialFunding: boolean;
}): boolean {
  if (input.fundingStatus === "funded") return input.activationEligible;
  if (input.fundingStatus === "partially_filled") return input.borrowerAcceptedPartialFunding;
  return false;
}

function buildWaitingNotes(
  fundingStatus: string,
  supplierFillCount: number,
  borrowerAcceptedPartialFunding: boolean,
): string[] {
  if (supplierFillCount === 0) {
    return [
      "No supplier positions are available yet because this quote has no accepted fills.",
      "Add matching supplier liquidity before borrower collateral lock.",
    ];
  }

  if (fundingStatus === "partially_filled" && !borrowerAcceptedPartialFunding) {
    return [
      "Partial supplier fills are reserved, but no positions activate until the borrower accepts partial funding.",
      "This keeps supplier accounting from moving ahead of borrower consent.",
    ];
  }

  return ["Supplier positions are waiting for a funded or borrower-accepted quote."];
}

function roundAssetAmount(value: number): number {
  return Number(value.toFixed(8));
}
