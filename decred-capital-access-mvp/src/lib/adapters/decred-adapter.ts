import type { EscrowPreview, Loan } from "../types";

export class DecredAdapter {
  createDemoEscrow(seed: string): EscrowPreview {
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

  getLoanEscrowChecklist(loan: Loan): string[] {
    return [
      `Escrow address: ${loan.escrowAddress}`,
      "Wait for conservative Decred confirmations before funding.",
      "Borrower cannot unilaterally withdraw collateral.",
      "Lender cannot unilaterally seize collateral.",
      "Any release or liquidation needs two of borrower, lender, and arbiter signatures.",
    ];
  }
}

export const decredAdapter = new DecredAdapter();
