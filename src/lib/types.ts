export const loanStatuses = [
  "draft_quote",
  "awaiting_keys",
  "escrow_created",
  "awaiting_collateral",
  "collateral_confirmed",
  "approved",
  "funded",
  "active",
  "repayment_pending",
  "repaid",
  "release_pending",
  "released",
  "margin_warning",
  "liquidation_review",
  "defaulted",
  "liquidating",
  "liquidated",
  "disputed",
  "canceled",
] as const;

export type LoanStatus = (typeof loanStatuses)[number];

export type RiskLevel = "healthy" | "watch" | "warning" | "liquidation";

export type LoanAction =
  | "simulate_collateral"
  | "approve_and_fund"
  | "simulate_repayment"
  | "release_collateral"
  | "mark_margin_warning"
  | "start_liquidation_review"
  | "mark_defaulted"
  | "complete_liquidation"
  | "cancel";

export interface Loan {
  id: string;
  ref: string;
  borrowerName: string;
  lenderName: string;
  status: LoanStatus;
  collateralDcr: number;
  collateralUsd: number;
  borrowAsset: "USDC" | "USDT" | "BTC";
  borrowAmount: number;
  initialLtvBps: number;
  currentLtvBps: number;
  aprBps: number;
  termDays: number;
  escrowAddress: string;
  redeemScript: string;
  borrowerPubkey: string;
  lenderPubkey: string;
  arbiterPubkey: string;
  depositTxid: string | null;
  payoutTxid: string | null;
  repaymentTxid: string | null;
  dueAt: string;
  createdAt: string;
  updatedAt: string;
  ticketProofStatus: "not_used" | "verified_exposure" | "research_only";
}

export interface LoanEvent {
  id: string;
  loanId: string;
  type: string;
  message: string;
  actor: "borrower" | "lender" | "arbiter" | "system" | "operator";
  createdAt: string;
}

export interface MarketSnapshot {
  dcrUsd: number;
  dcrBtc: number;
  krakenBid: number | null;
  krakenAsk: number | null;
  dcrdexBestBid: number | null;
  dcrdexBestAsk: number | null;
  dcrdexStableBookEmpty: boolean;
  sourceCount: number;
  stale: boolean;
  warnings: string[];
  updatedAt: string;
}

export interface ProtocolQuoteSummary {
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

export interface Quote {
  collateralDcr: number;
  borrowAmount: number;
  borrowAsset: Loan["borrowAsset"];
  dcrUsd: number;
  collateralUsd: number;
  ltvBps: number;
  maxBorrowAt35Ltv: number;
  liquidationThresholdBps: number;
  originationFee: number;
  estimatedAprBps: number;
  protocolQuote?: ProtocolQuoteSummary;
  warnings: string[];
}

export interface EscrowPreview {
  address: string;
  redeemScript: string;
  requiredSignatures: 2;
  totalSigners: 3;
  roles: string[];
  rpcChecklist: string[];
}

export interface TicketCollateralNote {
  status: "research_only";
  title: string;
  summary: string;
  blocker: string;
  nextValidation: string;
}
