import type { EscrowPreview, Loan } from "../types";

export type DecredNetworkMode = "demo" | "simnet" | "testnet" | "mainnet";

export type TransactionPurpose = "collateral_deposit" | "loan_payout" | "collateral_release" | "liquidation";

export interface UnsignedTransactionPreview {
  id: string;
  network: Exclude<DecredNetworkMode, "demo">;
  purpose: TransactionPurpose;
  loanId: string;
  fromAddress: string;
  toAddress: string;
  amountDcr: number;
  estimatedFeeDcr: number;
  requiredSignatures: number;
  totalSigners: number;
  rawTransactionHex: string | null;
  warnings: string[];
}

export interface TransactionReview {
  id: string;
  loanId: string;
  purpose: TransactionPurpose;
  status: "draft" | "ready_for_signing" | "blocked";
  network: DecredNetworkMode;
  summary: string;
  unsignedTransaction: UnsignedTransactionPreview | null;
  requiredApprovals: string[];
  blockers: string[];
  createdAt: string;
}

export interface DecredLendingAdapter {
  readonly mode: DecredNetworkMode;
  readonly canSign: boolean;
  readonly canBroadcast: boolean;
  createEscrowPreview(seed: string): EscrowPreview;
  getLoanEscrowChecklist(loan: Loan): string[];
  createTransactionReview(loan: Loan, purpose: TransactionPurpose): TransactionReview;
}
