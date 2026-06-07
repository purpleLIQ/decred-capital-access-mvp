import { describe, expect, it } from "vitest";
import { readSimnetRpcConfig } from "../adapters/simnet-rpc-config";
import { SimnetRpcUnsignedTransactionBuilder } from "../adapters/simnet-rpc-unsigned-builder";
import type { SimnetWalletRpcClient } from "../adapters/simnet-wallet-rpc-client";
import { assertUnsignedOnlyMethod } from "../adapters/simnet-wallet-rpc-client";
import { demoLoans } from "../fixtures";

const completeSimnetEnv = {
  DCR_SIMNET_ENABLED: "true",
  DCRD_SIMNET_RPC_URL: "https://127.0.0.1:19556",
  DCRD_SIMNET_RPC_USER: "dcrd-user",
  DCRD_SIMNET_RPC_PASSWORD: "dcrd-pass",
  DCRWALLET_SIMNET_BORROWER_RPC_URL: "https://127.0.0.1:19557",
  DCRWALLET_SIMNET_BORROWER_RPC_USER: "borrower-user",
  DCRWALLET_SIMNET_BORROWER_RPC_PASSWORD: "borrower-pass",
  DCRWALLET_SIMNET_LENDER_RPC_URL: "https://127.0.0.1:19558",
  DCRWALLET_SIMNET_LENDER_RPC_USER: "lender-user",
  DCRWALLET_SIMNET_LENDER_RPC_PASSWORD: "lender-pass",
  DCRWALLET_SIMNET_ARBITER_RPC_URL: "https://127.0.0.1:19559",
  DCRWALLET_SIMNET_ARBITER_RPC_USER: "arbiter-user",
  DCRWALLET_SIMNET_ARBITER_RPC_PASSWORD: "arbiter-pass",
};

function rpcClientStub(overrides: Partial<SimnetWalletRpcClient> = {}): SimnetWalletRpcClient {
  return {
    async listUnspentForAddress() {
      return [
        {
          txid: "simnetescrowtxid",
          vout: 0,
          amount: 100,
          confirmations: 6,
          spendable: true,
        },
      ];
    },
    async createRawTransaction() {
      return "01000000unsignedsimnetrawtx";
    },
    ...overrides,
  };
}

describe("simnet RPC unsigned transaction builder", () => {
  it("builds an unsigned release preview from confirmed escrow UTXOs", async () => {
    const config = readSimnetRpcConfig(completeSimnetEnv);
    const builder = new SimnetRpcUnsignedTransactionBuilder(config, rpcClientStub(), {
      releaseDestinationAddress: "SsBorrowerReturnAddress",
      estimatedFeeDcr: 0.002,
    });

    const result = await builder.build(demoLoans[0], "collateral_release");

    expect(result.blockers).toEqual([]);
    expect(result.unsignedTransaction?.rawTransactionHex).toBe("01000000unsignedsimnetrawtx");
    expect(result.unsignedTransaction?.network).toBe("simnet");
    expect(result.unsignedTransaction?.purpose).toBe("collateral_release");
    expect(result.unsignedTransaction?.fromAddress).toBe(demoLoans[0].escrowAddress);
    expect(result.unsignedTransaction?.toAddress).toBe("SsBorrowerReturnAddress");
    expect(result.unsignedTransaction?.amountDcr).toBe(99.998);
    expect(result.unsignedTransaction?.warnings).toContain("Unsigned simnet transaction only. It has not been signed.");
  });

  it("builds liquidation previews using the lender wallet role", async () => {
    const config = readSimnetRpcConfig(completeSimnetEnv);
    const roles: string[] = [];
    const builder = new SimnetRpcUnsignedTransactionBuilder(
      config,
      rpcClientStub({
        async listUnspentForAddress(role) {
          roles.push(role);
          return [{ txid: "liqtxid", vout: 1, amount: 25, confirmations: 3 }];
        },
      }),
      { liquidationDestinationAddress: "SsLiquidationAddress" },
    );

    const result = await builder.build(demoLoans[0], "liquidation");

    expect(roles).toEqual(["lender"]);
    expect(result.unsignedTransaction?.purpose).toBe("liquidation");
    expect(result.unsignedTransaction?.toAddress).toBe("SsLiquidationAddress");
  });

  it("blocks when simnet config is incomplete", async () => {
    const config = readSimnetRpcConfig({});
    const builder = new SimnetRpcUnsignedTransactionBuilder(config, rpcClientStub());

    const result = await builder.build(demoLoans[0], "collateral_release");

    expect(result.unsignedTransaction).toBeNull();
    expect(result.blockers).toContain("Simnet wallet RPC config is not ready.");
  });

  it("blocks when no confirmed escrow UTXOs are available", async () => {
    const config = readSimnetRpcConfig(completeSimnetEnv);
    const builder = new SimnetRpcUnsignedTransactionBuilder(
      config,
      rpcClientStub({
        async listUnspentForAddress() {
          return [{ txid: "unconfirmed", vout: 0, amount: 100, confirmations: 0 }];
        },
      }),
    );

    const result = await builder.build(demoLoans[0], "collateral_release");

    expect(result.unsignedTransaction).toBeNull();
    expect(result.blockers).toContain(`No confirmed simnet UTXOs found for escrow address ${demoLoans[0].escrowAddress}.`);
  });

  it("blocks unsafe RPC method names", () => {
    expect(() => assertUnsignedOnlyMethod("createrawtransaction")).not.toThrow();
    expect(() => assertUnsignedOnlyMethod("listunspent")).not.toThrow();
    expect(() => assertUnsignedOnlyMethod("signrawtransaction")).toThrow("outside the unsigned transaction boundary");
    expect(() => assertUnsignedOnlyMethod("sendrawtransaction")).toThrow("outside the unsigned transaction boundary");
    expect(() => assertUnsignedOnlyMethod("dumpprivkey")).toThrow("outside the unsigned transaction boundary");
  });
});
