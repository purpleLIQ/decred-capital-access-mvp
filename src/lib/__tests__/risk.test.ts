import { describe, expect, it } from "vitest";
import { buildQuote, calculateLtvBps, classifyRisk, isOracleHealthy } from "../risk";
import { demoMarketSnapshot } from "../fixtures";
import { protocolConfig } from "../protocol-config";
import type { MarketSnapshot } from "../types";

function marketOverride(overrides: Partial<MarketSnapshot>): MarketSnapshot {
  return { ...demoMarketSnapshot, ...overrides };
}

describe("risk calculations", () => {
  it("calculates LTV in basis points", () => {
    expect(calculateLtvBps(350, 1000)).toBe(3500);
  });

  it("classifies risk levels from protocol thresholds", () => {
    expect(classifyRisk(protocolConfig.targetLtvBps - 1)).toBe("healthy");
    expect(classifyRisk(protocolConfig.watchLtvBps)).toBe("watch");
    expect(classifyRisk(protocolConfig.warningLtvBps)).toBe("warning");
    expect(classifyRisk(protocolConfig.liquidationLtvBps)).toBe("liquidation");
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
  });

  it("calculates the platform origination fee from protocol config", () => {
    const quote = buildQuote({
      collateralDcr: 100,
      borrowAmount: 500,
      borrowAsset: "USDC",
      market: demoMarketSnapshot,
    });

    expect(quote.originationFee).toBe(5);
    expect(quote.estimatedAprBps).toBe(protocolConfig.estimatedAprBps);
    expect(quote.liquidationThresholdBps).toBe(protocolConfig.liquidationLtvBps);
  });

  it("accepts a healthy oracle with multiple live sources", () => {
    expect(isOracleHealthy(demoMarketSnapshot)).toBe(true);
  });

  it("marks stale or single-source oracle states as unhealthy", () => {
    expect(isOracleHealthy(marketOverride({ sourceCount: 1 }))).toBe(false);
    expect(isOracleHealthy(marketOverride({ stale: true }))).toBe(false);
  });

  it("adds quote warnings when oracle health is degraded", () => {
    const quote = buildQuote({
      collateralDcr: 100,
      borrowAmount: 250,
      borrowAsset: "USDC",
      market: marketOverride({ sourceCount: 1, warnings: [] }),
    });

    expect(quote.warnings).toContain("Oracle health is degraded; keep this quote in demo mode until pricing is reviewed.");
  });
});
