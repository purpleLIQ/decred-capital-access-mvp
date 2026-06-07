import type { EscrowPreview, Loan } from "../types";
import type { DecredLendingAdapter, TransactionPurpose, TransactionReview } from "./decred-types";
import { DemoDecredAdapter } from "./decred-adapter";

export class SimnetDecredAdapter implements DecredLendingAdapter {
  readonly mode = "simnet" as const;
  readonly canSign = false;
  private readonly previewAdapter = new DemoDecredAdapter();

  createEscrowPreview(seed: string): EscrowPreview {
    return this.previewAdapter.createEscrowPreview(seed);
  }

  getLoanEscrowChecklist(loan: Loan): string[] {
    return [
      ...this.previewAdapter.getLoanEscrowChecklist(loan),
      "Simnet adapter must connect to isolated dcrd and dcrwallet instances before raw transactions are enabled.",
      "Transaction signing remains disabled until the review screen and key boundary are implemented.",
    ];
  }

  createTransactionReview(loan: Loan, purpose: TransactionPurpose): TransactionReview {
    return {
      id: `txreview_${loan.id}_${purpose}`,
      loanId: loan.id,
      purpose,
      status: "blocked",
      network: this.mode,
      summary: "Simnet transaction review placeholder. Raw transaction construction is intentionally not implemented yet.",
      unsignedTransaction: null,
      requiredApprovals: ["Borrower", "Lender", "Arbiter"],
      blockers: [
        "Simnet wallet RPC configuration is missing.",
        "Unsigned transaction builder is not implemented.",
        "Signing must be performed outside the app-owned server process.",
      ],
      createdAt: new Date().toISOString(),
    };
  }
}
