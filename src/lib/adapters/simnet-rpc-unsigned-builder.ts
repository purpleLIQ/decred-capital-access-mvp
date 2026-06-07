import type { Loan } from "../types";
import type { TransactionPurpose } from "./decred-types";
import type { SimnetRpcConfig, SimnetWalletRole } from "./simnet-rpc-config";
import type { SimnetUnsignedTransactionBuildResult } from "./simnet-unsigned-builder";
import type { SimnetRpcUtxo, SimnetWalletRpcClient } from "./simnet-wallet-rpc-client";

export interface SimnetRpcUnsignedBuilderOptions {
  releaseDestinationAddress?: string;
  liquidationDestinationAddress?: string;
  estimatedFeeDcr?: number;
  minConfirmations?: number;
}

export class SimnetRpcUnsignedTransactionBuilder {
  constructor(
    private readonly rpcConfig: SimnetRpcConfig,
    private readonly rpcClient: SimnetWalletRpcClient,
    private readonly options: SimnetRpcUnsignedBuilderOptions = {},
  ) {}

  async build(loan: Loan, purpose: Extract<TransactionPurpose, "collateral_release" | "liquidation">): Promise<SimnetUnsignedTransactionBuildResult> {
    const blockers = validateRpcBuilderConfig(this.rpcConfig, loan, purpose);
    if (blockers.length > 0) {
      return {
        unsignedTransaction: null,
        blockers,
        warnings: ["RPC-backed unsigned builder is blocked until simnet config and loan escrow data are complete."],
      };
    }

    const role = walletRoleForPurpose(purpose);
    const feeDcr = this.options.estimatedFeeDcr ?? 0.001;
    const destinationAddress = destinationForPurpose(loan, purpose, this.options);

    if (!destinationAddress) {
      return {
        unsignedTransaction: null,
        blockers: [`Missing simnet ${purpose === "collateral_release" ? "release" : "liquidation"} destination address.`],
        warnings: [],
      };
    }

    const utxos = await this.rpcClient.listUnspentForAddress(role, loan.escrowAddress);
    const selectedUtxos = selectConfirmedUtxos(utxos, this.options.minConfirmations ?? 1);
    const totalInputDcr = sumDcr(selectedUtxos);
    const outputAmountDcr = Number((totalInputDcr - feeDcr).toFixed(8));

    if (selectedUtxos.length === 0) {
      return {
        unsignedTransaction: null,
        blockers: [`No confirmed simnet UTXOs found for escrow address ${loan.escrowAddress}.`],
        warnings: [],
      };
    }

    if (outputAmountDcr <= 0) {
      return {
        unsignedTransaction: null,
        blockers: ["Selected simnet UTXOs do not cover the estimated unsigned transaction fee."],
        warnings: [],
      };
    }

    const rawTransactionHex = await this.rpcClient.createRawTransaction(
      role,
      selectedUtxos.map((utxo) => ({ txid: utxo.txid, vout: utxo.vout })),
      [{ address: destinationAddress, amountDcr: outputAmountDcr }],
    );

    return {
      unsignedTransaction: {
        id: `unsigned_${loan.id}_${purpose}`,
        network: "simnet",
        purpose,
        loanId: loan.id,
        fromAddress: loan.escrowAddress,
        toAddress: destinationAddress,
        amountDcr: outputAmountDcr,
        estimatedFeeDcr: feeDcr,
        requiredSignatures: 2,
        totalSigners: 3,
        rawTransactionHex,
        warnings: [
          "Unsigned simnet transaction only. It has not been signed.",
          "Broadcast remains disabled until signed transaction validation and explicit operator action are implemented.",
        ],
      },
      blockers: [],
      warnings: [
        `Built unsigned simnet ${purpose === "collateral_release" ? "release" : "liquidation"} transaction preview from ${selectedUtxos.length} escrow UTXO(s).`,
      ],
    };
  }
}

function validateRpcBuilderConfig(
  rpcConfig: SimnetRpcConfig,
  loan: Loan,
  purpose: Extract<TransactionPurpose, "collateral_release" | "liquidation">,
): string[] {
  const blockers = [...rpcConfig.blockers];

  if (!rpcConfig.readyForWalletRpc) blockers.push("Simnet wallet RPC config is not ready.");
  if (!loan.escrowAddress) blockers.push("Loan escrow address is required.");
  if (!loan.redeemScript) blockers.push("Loan redeem script is required.");
  if (purpose !== "collateral_release" && purpose !== "liquidation") blockers.push("Only simnet release and liquidation builders are in scope.");

  return [...new Set(blockers)];
}

function walletRoleForPurpose(purpose: Extract<TransactionPurpose, "collateral_release" | "liquidation">): SimnetWalletRole {
  return purpose === "collateral_release" ? "borrower" : "lender";
}

function destinationForPurpose(
  loan: Loan,
  purpose: Extract<TransactionPurpose, "collateral_release" | "liquidation">,
  options: SimnetRpcUnsignedBuilderOptions,
): string | null {
  if (purpose === "collateral_release") return options.releaseDestinationAddress ?? fallbackAddress("return", loan.borrowerName);
  return options.liquidationDestinationAddress ?? fallbackAddress("liquidation", loan.lenderName);
}

function fallbackAddress(prefix: string, value: string): string {
  return `simnet_${prefix}_${value.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`;
}

function selectConfirmedUtxos(utxos: SimnetRpcUtxo[], minConfirmations: number): SimnetRpcUtxo[] {
  return utxos.filter((utxo) => (utxo.confirmations ?? 0) >= minConfirmations && utxo.amount > 0);
}

function sumDcr(utxos: SimnetRpcUtxo[]): number {
  return Number(utxos.reduce((total, utxo) => total + utxo.amount, 0).toFixed(8));
}
