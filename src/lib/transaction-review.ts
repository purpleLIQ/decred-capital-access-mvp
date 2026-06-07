import { decredAdapter } from "./adapters/decred-adapter";
import type { TransactionPurpose, TransactionReview } from "./adapters/decred-types";
import { getLoan } from "./demo-db";
import type { Loan } from "./types";

export type TransactionReviewApprovalRole = "borrower" | "lender" | "arbiter" | "operator";

export interface TransactionApprovalState {
  role: TransactionReviewApprovalRole;
  approved: boolean;
  label: string;
}

export interface TransactionReviewEnvelope {
  loan: Loan;
  review: TransactionReview;
  approvals: TransactionApprovalState[];
  canMoveToSigning: boolean;
}

export async function buildTransactionReviewEnvelope(input: {
  loanId: string;
  purpose: TransactionPurpose;
}): Promise<TransactionReviewEnvelope | null> {
  const loan = await getLoan(input.loanId);
  if (!loan) return null;

  const review = decredAdapter.createTransactionReview(loan, input.purpose);
  const approvals = buildApprovalState(review.requiredApprovals);

  return {
    loan,
    review,
    approvals,
    canMoveToSigning: canMoveToSigning(review, approvals),
  };
}

export function buildApprovalState(requiredApprovals: string[]): TransactionApprovalState[] {
  return requiredApprovals.map((approval) => ({
    role: inferApprovalRole(approval),
    approved: false,
    label: approval,
  }));
}

export function canMoveToSigning(review: TransactionReview, approvals: TransactionApprovalState[]): boolean {
  return review.status === "ready_for_signing" && review.blockers.length === 0 && approvals.every((approval) => approval.approved);
}

function inferApprovalRole(approval: string): TransactionReviewApprovalRole {
  const normalized = approval.toLowerCase();
  if (normalized.includes("borrower")) return "borrower";
  if (normalized.includes("lender")) return "lender";
  if (normalized.includes("arbiter")) return "arbiter";
  return "operator";
}
