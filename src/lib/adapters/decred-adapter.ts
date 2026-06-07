import type { EscrowPreview, Loan } from "../types";
import type { DecredLendingAdapter, TransactionPurpose, TransactionReview } from "./decred-types";

export class DemoDecredAdapter implements DecredLendingAdapter {
  readonly mode = "demo" as const;
  readonly canSign = false;

  createEscrowPreview(seed: string): EscrowPreview {
    const suffix = seed.replace(/[^a-z0-9]/gi, "").slice(-8).padStart(8, "0");

    return {
      address: `DsDemo2of3Escrow${suffix}`,
      redeemScript: `522102borrower${suffix}2102lender${suffix}2102arbiter${suffix}53ae`,
      requiredSignatures: 2,
      totalSigners: 3,
      roles: ["Borrower key", "Lender or treasury key", "Independent arbiter key"],
      rpcChecklist: [
        'dcrctl --wallet createmultisig 2 "[borrowerPubkey,lenderPubkey,arbiterPubkey]"',
        "dcrctl --wallet importscript <redeemScript>",
        "dcrctl --wallet listunspent 1 9999999 '[escrowAddress]'",
        "dcrctl --wallet createrawtransaction <escrowUtxo> <releaseOrLiquidationOutput>",
        "dcrctl --wallet signrawtransaction <rawTx> <prevScripts>",
        "dcrctl --wallet sendrawtransaction <fullySignedTx>",
      ],
    };
  }

  createDemoEscrow(seed: string): EscrowPreview {
    return this.createEscrowPreview(seed);
  }

  getLoanEscrowChecklist(loan: Loan): string[] {
    return [
      `Escrow address: ${loan.escrowAddress}`,
      "Wait for conservative Decred confirmations before funding.",
      "Borrower cannot unilaterally withdraw collateral.",
      "Lender cannot unilaterally seize collateral.",
      "Any release or liquidation needs two of borrower, lender, and arbiter signatures.",
    ];
  }

  createTransactionReview(loan: Loan, purpose: TransactionPurpose): TransactionReview {
    return {
      id: `txreview_${loan.id}_${purpose}`,
      loanId: loan.id,
      purpose,
      status: "blocked",
      network: this.mode,
      summary: "Demo mode can preview the transaction workflow, but it cannot build or sign a real Decred transaction.",
      unsignedTransaction: null,
      requiredApprovals: ["Borrower", "Lender", "Arbiter or operator"],
      blockers: [
        "Demo adapter is not connected to dcrd or dcrwallet.",
        "No raw transaction has been built.",
        "No signing operation is allowed in demo mode.",
      ],
      createdAt: new Date().toISOString(),
    };
  }
}

export const decredAdapter = new DemoDecredAdapter();
