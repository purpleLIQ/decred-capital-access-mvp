import { describe, expect, it } from "vitest";
import { DemoDecredAdapter } from "../adapters/decred-adapter";
import { SimnetDecredAdapter } from "../adapters/simnet-decred-adapter";
import { demoLoans } from "../fixtures";

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

  it("preserves 2-of-3 escrow preview semantics", () => {
    const adapter = new DemoDecredAdapter();
    const escrow = adapter.createEscrowPreview("DCR-1234");

    expect(escrow.requiredSignatures).toBe(2);
    expect(escrow.totalSigners).toBe(3);
    expect(escrow.roles).toHaveLength(3);
  });
});
