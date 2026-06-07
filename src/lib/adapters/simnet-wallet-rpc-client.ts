import type { SimnetRpcConfig, SimnetWalletRole, SimnetWalletRpcConfig } from "./simnet-rpc-config";

export interface SimnetRpcUtxo {
  txid: string;
  vout: number;
  amount: number;
  scriptPubKey?: string;
  redeemScript?: string;
  address?: string;
  confirmations?: number;
  spendable?: boolean;
}

export interface SimnetRawTransactionInput {
  txid: string;
  vout: number;
  tree?: number;
}

export interface SimnetRawTransactionOutput {
  address: string;
  amountDcr: number;
}

export interface SimnetWalletRpcClient {
  listUnspentForAddress(role: SimnetWalletRole, address: string): Promise<SimnetRpcUtxo[]>;
  createRawTransaction(
    role: SimnetWalletRole,
    inputs: SimnetRawTransactionInput[],
    outputs: SimnetRawTransactionOutput[],
  ): Promise<string>;
}

export class SimnetWalletRpcError extends Error {
  constructor(message: string, readonly code?: number) {
    super(message);
  }
}

const blockedRpcMethods = new Set([
  "sendrawtransaction",
  "signrawtransaction",
  "signrawtransactionwithwallet",
  "walletpassphrase",
  "walletlock",
  "importprivkey",
  "dumpprivkey",
  "dumpwallet",
]);

export class JsonSimnetWalletRpcClient implements SimnetWalletRpcClient {
  constructor(private readonly config: SimnetRpcConfig, private readonly fetchImpl: typeof fetch = fetch) {}

  async listUnspentForAddress(role: SimnetWalletRole, address: string): Promise<SimnetRpcUtxo[]> {
    const result = await this.callWalletRpc<unknown>(role, "listunspent", [1, 9999999, [address]]);
    if (!Array.isArray(result)) return [];

    return result.flatMap((item) => normalizeUtxo(item));
  }

  async createRawTransaction(
    role: SimnetWalletRole,
    inputs: SimnetRawTransactionInput[],
    outputs: SimnetRawTransactionOutput[],
  ): Promise<string> {
    const outputMap = outputs.reduce<Record<string, number>>((acc, output) => {
      acc[output.address] = output.amountDcr;
      return acc;
    }, {});
    const result = await this.callWalletRpc<unknown>(role, "createrawtransaction", [inputs, outputMap]);

    if (typeof result !== "string" || result.length === 0) {
      throw new SimnetWalletRpcError("createrawtransaction did not return unsigned raw transaction hex.");
    }

    return result;
  }

  private async callWalletRpc<T>(role: SimnetWalletRole, method: string, params: unknown[]): Promise<T> {
    assertUnsignedOnlyMethod(method);
    const wallet = this.config.wallets[role];

    if (!this.config.readyForWalletRpc || !wallet.configured || !wallet.rpcUrl || !wallet.rpcUser) {
      throw new SimnetWalletRpcError(`Simnet ${role} wallet RPC is not configured.`);
    }

    const password = process.env[wallet.rpcPasswordEnvVar];
    if (!password) {
      throw new SimnetWalletRpcError(`Missing ${wallet.rpcPasswordEnvVar}.`);
    }

    const response = await this.fetchImpl(wallet.rpcUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${wallet.rpcUser}:${password}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "1.0", id: `simnet-${role}-${method}`, method, params }),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new SimnetWalletRpcError(`Wallet RPC ${method} failed with HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as { result?: T; error?: { code?: number; message?: string } | null };
    if (payload.error) {
      throw new SimnetWalletRpcError(payload.error.message ?? `Wallet RPC ${method} failed.`, payload.error.code);
    }

    return payload.result as T;
  }
}

export function assertUnsignedOnlyMethod(method: string): void {
  const normalized = method.toLowerCase();
  if (blockedRpcMethods.has(normalized)) {
    throw new SimnetWalletRpcError(`RPC method ${method} is outside the unsigned transaction boundary.`);
  }
}

export function rpcWalletRolesReady(config: SimnetRpcConfig): SimnetWalletRole[] {
  return Object.entries(config.wallets)
    .filter((entry): entry is [SimnetWalletRole, SimnetWalletRpcConfig] => entry[1].configured)
    .map(([role]) => role);
}

function normalizeUtxo(value: unknown): SimnetRpcUtxo[] {
  if (!value || typeof value !== "object") return [];
  const item = value as Record<string, unknown>;
  const txid = typeof item.txid === "string" ? item.txid : null;
  const vout = typeof item.vout === "number" ? item.vout : null;
  const amount = typeof item.amount === "number" ? item.amount : null;

  if (!txid || vout === null || amount === null) return [];

  return [
    {
      txid,
      vout,
      amount,
      scriptPubKey: typeof item.scriptPubKey === "string" ? item.scriptPubKey : undefined,
      redeemScript: typeof item.redeemScript === "string" ? item.redeemScript : undefined,
      address: typeof item.address === "string" ? item.address : undefined,
      confirmations: typeof item.confirmations === "number" ? item.confirmations : undefined,
      spendable: typeof item.spendable === "boolean" ? item.spendable : undefined,
    },
  ];
}
