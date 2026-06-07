import type { EscrowPreview, Loan } from "../types";
import type { DecredLendingAdapter, TransactionPurpose, TransactionReview } from "./decred-types";
import { DemoDecredAdapter } from "./decred-adapter";
import { readSimnetRpcConfig, type SimnetRpcConfig } from "./simnet-rpc-config";

export class SimnetDecredAdapter implements DecredLendingAdapter {
  readonly mode = "simnet" as const;
  readonly canSign = false;
  readonly canBroadcast = false;
  private readonly previewAdapter = new DemoDecredAdapter();

  constructor(private readonly rpcConfig: SimnetRpcConfig = readSimnetRpcConfig()) {}

  createEscrowPreview(seed: string): EscrowPreview {
    return this.previewAdapter.createEscrowPreview(seed);
  }

  getLoanEscrowChecklist(loan: Loan): string[] {
    return [
      ...this.previewAdapter.getLoanEscrowChecklist(loan),
      "Configure isolated simnet dcrd plus separate borrower, lender, and arbiter dcrwallet RPC endpoints.",
      "Build unsigned release/liquidation transactions on simnet before any signing workflow is enabled.",
      "Transaction signing remains outside the app-owned server process.",
    ];
  }

  createTransactionReview(loan: Loan, purpose: TransactionPurpose): TransactionReview {
    const configBlockers = this.rpcConfig.readyForWalletRpc
      ? ["Simnet RPC config is loaded, but no RPC transaction builder is connected yet."]
      : this.rpcConfig.blockers;

    return {
      id: `txreview_${loan.id}_${purpose}`,
      loanId: loan.id,
      purpose,
      status: "blocked",
      network: this.mode,
      summary: this.rpcConfig.readyForWalletRpc
        ? "Simnet wallet RPC config is loaded. Raw transaction construction is still intentionally blocked until the unsigned builder is implemented."
        : "Simnet transaction review placeholder. Wallet RPC configuration and raw transaction construction are intentionally not implemented yet.",
      unsignedTransaction: null,
      requiredApprovals: ["Borrower", "Lender", "Arbiter"],
      blockers: [
        ...configBlockers,
        "Unsigned transaction builder is not implemented.",
        "Signing must be performed outside the app-owned server process.",
        "Broadcast remains disabled until signed transaction validation and explicit operator action are implemented.",
      ],
      createdAt: new Date().toISOString(),
    };
  }
}
