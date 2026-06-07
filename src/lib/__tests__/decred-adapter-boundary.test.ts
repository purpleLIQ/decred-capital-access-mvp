import { describe, expect, it } from "vitest";
import { DemoDecredAdapter } from "../adapters/decred-adapter";
import { readSimnetRpcConfig } from "../adapters/simnet-rpc-config";
import { SimnetDecredAdapter } from "../adapters/simnet-decred-adapter";
import { StaticSimnetUnsignedTransactionBuilder } from "../adapters/simnet-unsigned-builder";
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

describe("Decred adapter safety boundary", () => {
  it("keeps demo mode unable to sign or build raw transactions", () => {
    const adapter = new DemoDecredAdapter();
    const review = adapter.createTransactionReview(demoLoans[0], "collateral_release");

    expect(adapter.mode).toBe("demo");
    expect(adapter.canSign).toBe(false);
    expect(adapter.canBroadcast).toBe(false);
    expect("broadcastTransaction" in adapter).toBe(false);
    expect(review.status).toBe("blocked");
    expect(review.unsignedTransaction).toBeNull();
    expect(review.blockers).toContain("No signing operation is allowed in demo mode.");
  });

  it("keeps simnet adapter blocked until RPC and transaction builder are implemented", () => {
    const adapter = new SimnetDecredAdapter();
    const review = adapter.createTransactionReview(demoLoans[0], "liquidation");

    expect(adapter.mode).toBe("simnet");
    expect(adapter.canSign).toBe(false);
    expect(adapter.canBroadcast).toBe(false);
    expect("broadcastTransaction" in adapter).toBe(false);
    expect(review.status).toBe("blocked");
    expect(review.network).toBe("simnet");
    expect(review.unsignedTransaction?.rawTransactionHex ?? null).toBeNull();
    expect(review.blockers).toContain("Unsigned transaction builder is not implemented.");
  });

  it("keeps simnet reviews blocked even when wallet RPC config is complete", () => {
    const config = readSimnetRpcConfig(completeSimnetEnv);
    const adapter = new SimnetDecredAdapter(config);
    const review = adapter.createTransactionReview(demoLoans[0], "collateral_release");

    expect(config.readyForWalletRpc).toBe(true);
    expect(adapter.canSign).toBe(false);
    expect(adapter.canBroadcast).toBe(false);
    expect(review.status).toBe("blocked");
    expect(review.unsignedTransaction).toBeNull();
    expect(review.blockers).toContain("Unsigned transaction builder is not implemented.");
    expect(review.blockers).toContain("No simnet wallet RPC call has produced unsigned raw transaction hex.");
  });

  it("can expose an injected simnet unsigned release preview without signing or broadcasting", () => {
    const config = readSimnetRpcConfig(completeSimnetEnv);
    const adapter = new SimnetDecredAdapter(
      config,
      new StaticSimnetUnsignedTransactionBuilder({
        rawTransactionHexByPurpose: {
          collateral_release: "01000000unsignedreleasepreview",
        },
      }),
    );
    const review = adapter.createTransactionReview(demoLoans[0], "collateral_release");

    expect(review.status).toBe("blocked");
    expect(review.unsignedTransaction?.rawTransactionHex).toBe("01000000unsignedreleasepreview");
    expect(review.unsignedTransaction?.network).toBe("simnet");
    expect(review.unsignedTransaction?.purpose).toBe("collateral_release");
    expect(adapter.canSign).toBe(false);
    expect(adapter.canBroadcast).toBe(false);
    expect(review.blockers).toContain("Signing must be performed outside the app-owned server process.");
    expect(review.blockers).toContain("Broadcast remains disabled until signed transaction validation and explicit operator action are implemented.");
  });

  it("does not create an unsigned preview without raw transaction hex", () => {
    const config = readSimnetRpcConfig(completeSimnetEnv);
    const adapter = new SimnetDecredAdapter(config, new StaticSimnetUnsignedTransactionBuilder());
    const review = adapter.createTransactionReview(demoLoans[0], "liquidation");

    expect(review.status).toBe("blocked");
    expect(review.unsignedTransaction).toBeNull();
    expect(review.blockers).toContain("Unsigned raw transaction hex is required before a review can move to signing.");
  });

  it("requires explicit simnet enablement and separate wallet RPC credentials", () => {
    const config = readSimnetRpcConfig({});

    expect(config.enabled).toBe(false);
    expect(config.readyForWalletRpc).toBe(false);
    expect(config.missingEnvVars).toContain("DCRD_SIMNET_RPC_URL");
    expect(config.missingEnvVars).toContain("DCRWALLET_SIMNET_BORROWER_RPC_URL");
    expect(config.missingEnvVars).toContain("DCRWALLET_SIMNET_LENDER_RPC_URL");
    expect(config.missingEnvVars).toContain("DCRWALLET_SIMNET_ARBITER_RPC_URL");
    expect(config.blockers).toContain("Simnet RPC config is disabled. Set DCR_SIMNET_ENABLED=true only for isolated simnet.");
  });

  it("rejects unsafe or invalid simnet RPC URLs", () => {
    const config = readSimnetRpcConfig({
      ...completeSimnetEnv,
      DCRD_SIMNET_RPC_URL: "https://mainnet.example.invalid",
      DCRWALLET_SIMNET_BORROWER_RPC_URL: "not-a-url",
    });

    expect(config.readyForWalletRpc).toBe(false);
    expect(config.blockers).toContain("DCRD_SIMNET_RPC_URL must not point at a mainnet endpoint.");
    expect(config.blockers).toContain("DCRWALLET_SIMNET_BORROWER_RPC_URL must be a valid HTTP(S) URL.");
  });

  it("preserves 2-of-3 escrow preview semantics", () => {
    const adapter = new DemoDecredAdapter();
    const escrow = adapter.createEscrowPreview("DCR-1234");

    expect(escrow.requiredSignatures).toBe(2);
    expect(escrow.totalSigners).toBe(3);
    expect(escrow.roles).toHaveLength(3);
  });
});
