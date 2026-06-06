import { describe, expect, it } from "vitest";
import { buildQuote, calculateLtvBps, classifyRisk, isOracleHealthy } from "../risk";
import { demoMarketSnapshot } from "../fixtures";

describe("risk calculations", () => {
  it("calculates LTV in basis points", () => {
    expect(calculateLtvBps(350, 1000)).toBe(3500);
  });

  it("classifies risk levels", () => {
    expect(classifyRisk(3000)).toBe("healthy");
    expect(classifyRisk(5000)).toBe("watch");
    expect(classifyRisk(6500)).toBe("warning");
    expect(classifyRisk(7300)).toBe("liquidation");
  });

  it("builds quotes with stablecoin liquidity warnings", () => {
    const quote = buildQuote({
      collateralDcr: 100,
      borrowAmount: 350,
      borrowAsset: "USDC",
      market: demoMarketSnapshot,
    });

    expect(quote.ltvBps).toBeGreaterThan(2800);
    expect(quote.maxBorrowAt35Ltv).toBeGreaterThan(400);
    expect(quote.warnings).toContain("DCRDEX stablecoin liquidity is thin, so liquidation remains manual in v1.");
    expect(quote.platformFeeBps).toBe(100);
    expect(quote.platformFeeAmount).toBe(3.5);
    expect(quote.netBorrowProceeds).toBe(346.5);
  });

  it("accepts a healthy oracle with multiple live sources", () => {
    expect(isOracleHealthy(demoMarketSnapshot)).toBe(true);
  });
});
