import type { Loan } from "../types";
import type { TransactionPurpose, UnsignedTransactionPreview } from "./decred-types";
import type { SimnetRpcConfig } from "./simnet-rpc-config";

export interface SimnetUnsignedTransactionBuildInput {
  loan: Loan;
  purpose: Extract<TransactionPurpose, "collateral_release" | "liquidation">;
  rpcConfig: SimnetRpcConfig;
  destinationAddress?: string;
  rawTransactionHex?: string;
  estimatedFeeDcr?: number;
}

export interface SimnetUnsignedTransactionBuildResult {
  unsignedTransaction: UnsignedTransactionPreview | null;
  blockers: string[];
  warnings: string[];
}

export interface SimnetUnsignedTransactionBuilder {
  build(input: SimnetUnsignedTransactionBuildInput): SimnetUnsignedTransactionBuildResult;
}

export interface StaticSimnetUnsignedTransactionBuilderOptions {
  rawTransactionHexByPurpose?: Partial<Record<Extract<TransactionPurpose, "collateral_release" | "liquidation">, string>>;
  destinationAddressByPurpose?: Partial<Record<Extract<TransactionPurpose, "collateral_release" | "liquidation">, string>>;
  estimatedFeeDcr?: number;
}

export class BlockedSimnetUnsignedTransactionBuilder implements SimnetUnsignedTransactionBuilder {
  build(input: SimnetUnsignedTransactionBuildInput): SimnetUnsignedTransactionBuildResult {
    return {
      unsignedTransaction: null,
      blockers: [
        ...input.rpcConfig.blockers,
        "Unsigned transaction builder is not implemented.",
        "No simnet wallet RPC call has produced unsigned raw transaction hex.",
      ],
      warnings: [
        "Builder is blocked by default so the app cannot silently create, sign, or broadcast transactions.",
      ],
    };
  }
}

export class StaticSimnetUnsignedTransactionBuilder implements SimnetUnsignedTransactionBuilder {
  constructor(private readonly options: StaticSimnetUnsignedTransactionBuilderOptions = {}) {}

  build(input: SimnetUnsignedTransactionBuildInput): SimnetUnsignedTransactionBuildResult {
    const rawTransactionHex = input.rawTransactionHex ?? this.options.rawTransactionHexByPurpose?.[input.purpose];
    const destinationAddress =
      input.destinationAddress ?? this.options.destinationAddressByPurpose?.[input.purpose] ?? fallbackDestinationForPurpose(input.loan, input.purpose);
    const estimatedFeeDcr = input.estimatedFeeDcr ?? this.options.estimatedFeeDcr ?? 0.001;
    const blockers = validateUnsignedBuildInput({ ...input, rawTransactionHex });

    if (blockers.length > 0) {
      return {
        unsignedTransaction: null,
        blockers,
        warnings: ["Unsigned preview was not created because required simnet inputs are missing."],
      };
    }

    return {
      unsignedTransaction: {
        id: `unsigned_${input.loan.id}_${input.purpose}`,
        network: "simnet",
        purpose: input.purpose,
        loanId: input.loan.id,
        fromAddress: input.loan.escrowAddress,
        toAddress: destinationAddress,
        amountDcr: input.loan.collateralDcr,
        estimatedFeeDcr,
        requiredSignatures: 2,
        totalSigners: 3,
        rawTransactionHex,
        warnings: [
          "Unsigned simnet preview only. It must be reviewed and signed outside the app-owned server process.",
          "Broadcast remains disabled until signed transaction validation and explicit operator action are implemented.",
        ],
      },
      blockers: [],
      warnings: ["Unsigned simnet transaction preview created without signing or broadcasting."],
    };
  }
}

function validateUnsignedBuildInput(input: SimnetUnsignedTransactionBuildInput): string[] {
  const blockers = [...input.rpcConfig.blockers];

  if (!input.rpcConfig.readyForWalletRpc) {
    blockers.push("Simnet wallet RPC config is not ready.");
  }

  if (!input.rawTransactionHex) {
    blockers.push("Unsigned raw transaction hex is required before a review can move to signing.");
  }

  if (input.purpose !== "collateral_release" && input.purpose !== "liquidation") {
    blockers.push("Only simnet release and liquidation builders are in scope.");
  }

  if (!input.loan.escrowAddress || !input.loan.redeemScript) {
    blockers.push("Loan escrow address and redeem script are required.");
  }

  return [...new Set(blockers)];
}

function fallbackDestinationForPurpose(
  loan: Loan,
  purpose: Extract<TransactionPurpose, "collateral_release" | "liquidation">,
): string {
  if (purpose === "collateral_release") return `simnet_return_${loan.borrowerName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`;
  return `simnet_liquidation_${loan.lenderName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`;
}
