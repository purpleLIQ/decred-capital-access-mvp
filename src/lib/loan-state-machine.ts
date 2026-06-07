import type { Loan, LoanAction, LoanEvent, LoanStatus } from "./types";

export const allowedTransitions: Record<LoanStatus, LoanStatus[]> = {
  draft_quote: ["awaiting_keys", "canceled"],
  awaiting_keys: ["escrow_created", "canceled"],
  escrow_created: ["awaiting_collateral", "canceled"],
  awaiting_collateral: ["collateral_confirmed", "canceled"],
  collateral_confirmed: ["active", "approved", "liquidation_review", "canceled"],
  approved: ["funded", "canceled"],
  funded: ["active"],
  active: ["repayment_pending", "margin_warning", "liquidation_review", "defaulted"],
  repayment_pending: ["repaid", "active"],
  repaid: ["release_pending"],
  release_pending: ["released", "disputed"],
  released: [],
  margin_warning: ["active", "repayment_pending", "liquidation_review", "defaulted"],
  liquidation_review: ["active", "defaulted", "liquidating", "disputed"],
  defaulted: ["liquidating", "disputed"],
  liquidating: ["liquidated", "disputed"],
  liquidated: [],
  disputed: ["active", "released", "liquidated"],
  canceled: [],
};

export function canTransition(from: LoanStatus, to: LoanStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export function actionToStatus(action: LoanAction, loan: Loan): LoanStatus {
  switch (action) {
    case "simulate_collateral":
      return loan.status === "escrow_created" ? "awaiting_collateral" : "collateral_confirmed";
    case "approve_and_fund":
      return "active";
    case "simulate_repayment":
      return loan.status === "repayment_pending" ? "repaid" : "repayment_pending";
    case "release_collateral":
      return loan.status === "repaid" ? "release_pending" : "released";
    case "mark_margin_warning":
      return "margin_warning";
    case "start_liquidation_review":
      return "liquidation_review";
    case "mark_defaulted":
      return "defaulted";
    case "complete_liquidation":
      return loan.status === "defaulted" ? "liquidating" : "liquidated";
    case "cancel":
      return "canceled";
    default:
      return loan.status;
  }
}

export function transitionLoan(loan: Loan, action: LoanAction): { loan: Loan; event: Omit<LoanEvent, "id"> } {
  const now = new Date().toISOString();
  const requestedStatus = actionToStatus(action, loan);
  const nextStatus = canTransition(loan.status, requestedStatus) ? requestedStatus : loan.status;
  const updatedLoan: Loan = {
    ...loan,
    status: nextStatus,
    updatedAt: now,
    depositTxid:
      action === "simulate_collateral" && !loan.depositTxid
        ? `dcr-demo-deposit-${loan.ref.toLowerCase()}`
        : loan.depositTxid,
    payoutTxid:
      action === "approve_and_fund" && nextStatus === "active" && !loan.payoutTxid
        ? `base-sepolia-usdc-${loan.ref.toLowerCase()}`
        : loan.payoutTxid,
    repaymentTxid:
      action === "simulate_repayment" && !loan.repaymentTxid
        ? `base-sepolia-repay-${loan.ref.toLowerCase()}`
        : loan.repaymentTxid,
  };

  return {
    loan: updatedLoan,
    event: {
      loanId: loan.id,
      type: action,
      message: eventMessage(action, loan.status, nextStatus),
      actor: action.includes("simulate") ? "system" : "operator",
      createdAt: now,
    },
  };
}

function eventMessage(action: LoanAction, from: LoanStatus, to: LoanStatus): string {
  if (from === to) {
    return `Action "${action}" was recorded, but the loan stayed in ${from}.`;
  }

  const messages: Record<LoanAction, string> = {
    simulate_collateral: "Demo DCR collateral was detected and confirmation checks passed.",
    approve_and_fund: "Operator approved the loan and demo USDC funding is active.",
    simulate_repayment: "Demo repayment was detected at the repayment target.",
    release_collateral: "Collateral release workflow advanced toward borrower return.",
    mark_margin_warning: "Loan moved into margin warning for borrower/operator attention.",
    start_liquidation_review: "Loan entered review-gated liquidation workflow.",
    mark_defaulted: "Loan was marked defaulted after missing required remediation.",
    complete_liquidation: "Manual liquidation workflow advanced.",
    cancel: "Loan was canceled before funding.",
  };

  return `${messages[action]} Status moved from ${from} to ${to}.`;
}
