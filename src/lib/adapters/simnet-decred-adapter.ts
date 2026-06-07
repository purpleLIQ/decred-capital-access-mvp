import type { EscrowPreview, Loan } from "../types";
import type { DecredLendingAdapter, TransactionPurpose, TransactionReview } from "./decred-types";
import { DemoDecredAdapter } from "./decred-adapter";
import { readSimnetRpcConfig, type SimnetRpcConfig } from "./simnet-rpc-config";
import {
  BlockedSimnetUnsignedTransactionBuilder,
  type SimnetUnsignedTransactionBuilder,
} from "./simnet-unsigned-builder";

export class SimnetDecredAdapter implements DecredLendingAdapter {
  readonly mode = "simnet" as const;
  readonly canSign = false;
  readonly canBroadcast = false;
  private readonly previewAdapter = new DemoDecredAdapter();

  constructor(
    private readonly rpcConfig: SimnetRpcConfig = readSimnetRpcConfig(),
    private readonly unsignedBuilder: SimnetUnsignedTransactionBuilder = new BlockedSimnetUnsignedTransactionBuilder(),
  ) {}

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
    const buildResult = this.buildUnsignedTransaction(loan, purpose);
    const unsignedTransaction = buildResult.unsignedTransaction;
    const blockers = [
      ...buildResult.blockers,
      "Signing must be performed outside the app-owned server process.",
      "Broadcast remains disabled until signed transaction validation and explicit operator action are implemented.",
    ];
    const status = blockers.length === 0 && unsignedTransaction?.rawTransactionHex ? "draft" : "blocked";

    return {
      id: `txreview_${loan.id}_${purpose}`,
      loanId: loan.id,
      purpose,
      status,
      network: this.mode,
      summary: unsignedTransaction?.rawTransactionHex
        ? "Simnet unsigned transaction preview is ready for review. Signing and broadcast remain outside the app-owned server process."
        : "Simnet transaction review placeholder. Wallet RPC configuration and raw transaction construction are intentionally blocked until the unsigned builder is connected.",
      unsignedTransaction,
      requiredApprovals: ["Borrower", "Lender", "Arbiter"],
      blockers,
      createdAt: new Date().toISOString(),
    };
  }

  private buildUnsignedTransaction(loan: Loan, purpose: TransactionPurpose) {
    if (purpose !== "collateral_release" && purpose !== "liquidation") {
      return {
        unsignedTransaction: null,
        blockers: [
          ...this.rpcConfig.blockers,
          "Only simnet collateral release and liquidation transaction builders are in scope.",
          "Unsigned transaction builder is not implemented for this purpose.",
        ],
        warnings: [],
      };
    }

    return this.unsignedBuilder.build({ loan, purpose, rpcConfig: this.rpcConfig });
  }
}
