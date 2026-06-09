import { describe, expect, it } from "vitest";

import {
  DEFAULT_ORACLE_POLICY_CONFIG,
  evaluateLoanHealth,
  summarizeOracleSources,
  type OraclePolicyConfig,
  type PricePoint,
} from "..";

const now = "2026-06-09T12:00:00.000Z";
const freshObservedAt = "2026-06-09T11:59:00.000Z";

const baseConfig: OraclePolicyConfig = {
  ...DEFAULT_ORACLE_POLICY_CONFIG,
  maxOracleAgeMs: 5 * 60 * 1000,
  maxSourceDivergenceBps: 500,
  warningLtvBps: 6500,
  topUpLtvBps: 7000,
  arbiterReviewLtvBps: 7500,
  fallbackReviewLtvBps: 8500,
};

function prices(asset: "DCR" | "BTC", values: number[], observedAt = freshObservedAt): PricePoint[] {
  return values.map((usdPrice, index) => ({
    source: `oracle-${index + 1}`,
    observedAt,
    asset,
    usdPrice,
  }));
}

describe("oracle policy scaffolding", () => {
  it("marks a well-collateralized loan healthy", () => {
    const evaluation = evaluateLoanHealth({
      loanId: "loan-healthy",
      collateralAsset: "DCR",
      collateralAmount: 100,
      borrowAsset: "BTC",
      borrowAmount: 1,
      collateralPrices: prices("DCR", [20, 20.1, 19.9]),
      borrowAssetPrices: prices("BTC", [10_000, 10_100, 9_900]),
      now,
      config: baseConfig,
    });

    expect(evaluation.decision).toBe("healthy");
    expect(evaluation.phase).toBe("healthy");
    expect(evaluation.ltvBps).toBeCloseTo(5000);
    expect(evaluation.blockers).toEqual([]);
    expect(evaluation.automaticFallbackAllowed).toBe(false);
  });

  it("moves through warning, top-up, and arbiter review thresholds", () => {
    const warning = evaluateLoanHealth({
      loanId: "loan-warning",
      collateralAsset: "DCR",
      collateralAmount: 100,
      borrowAsset: "BTC",
      borrowAmount: 1,
      collateralPrices: prices("DCR", [20]),
      borrowAssetPrices: prices("BTC", [13_200]),
      now,
      config: baseConfig,
    });
    const topUp = evaluateLoanHealth({
      ...warningInput("loan-top-up", 14_200),
      config: baseConfig,
    });
    const arbiter = evaluateLoanHealth({
      ...warningInput("loan-arbiter", 15_200),
      config: baseConfig,
    });

    expect(warning.decision).toBe("warning");
    expect(warning.phase).toBe("warning_window");
    expect(topUp.decision).toBe("top_up_required");
    expect(topUp.phase).toBe("top_up_window");
    expect(arbiter.decision).toBe("arbiter_review");
    expect(arbiter.phase).toBe("arbiter_intervention");
  });

  it("blocks fallback review when LTV reaches the fallback threshold", () => {
    const evaluation = evaluateLoanHealth({
      ...warningInput("loan-fallback", 17_500),
      config: baseConfig,
    });

    expect(evaluation.decision).toBe("fallback_review_blocked");
    expect(evaluation.phase).toBe("fallback_liquidation_review");
    expect(evaluation.automaticFallbackAllowed).toBe(false);
  });

  it("blocks policy decisions when oracle data is stale", () => {
    const evaluation = evaluateLoanHealth({
      loanId: "loan-stale",
      collateralAsset: "DCR",
      collateralAmount: 100,
      borrowAsset: "BTC",
      borrowAmount: 1,
      collateralPrices: prices("DCR", [20], "2026-06-09T11:40:00.000Z"),
      borrowAssetPrices: prices("BTC", [10_000]),
      now,
      config: baseConfig,
    });

    expect(evaluation.decision).toBe("fallback_review_blocked");
    expect(evaluation.collateralOracle.status).toBe("stale");
    expect(evaluation.blockers).toContain("Oracle prices for DCR are stale.");
    expect(evaluation.automaticFallbackAllowed).toBe(false);
  });

  it("blocks policy decisions when oracle sources diverge beyond policy", () => {
    const summary = summarizeOracleSources({
      asset: "BTC",
      prices: prices("BTC", [10_000, 12_000, 14_000]),
      now,
      config: {
        ...baseConfig,
        maxSourceDivergenceBps: 1000,
      },
    });

    expect(summary.status).toBe("divergent");
    expect(summary.blockers).toContain("Oracle prices for BTC diverge beyond policy.");
  });

  it("blocks policy decisions when oracle data is missing", () => {
    const evaluation = evaluateLoanHealth({
      loanId: "loan-missing-oracle",
      collateralAsset: "DCR",
      collateralAmount: 100,
      borrowAsset: "BTC",
      borrowAmount: 1,
      collateralPrices: [],
      borrowAssetPrices: prices("BTC", [10_000]),
      now,
      config: baseConfig,
    });

    expect(evaluation.decision).toBe("fallback_review_blocked");
    expect(evaluation.collateralOracle.status).toBe("missing");
    expect(evaluation.blockers).toContain("Missing oracle prices for DCR.");
  });
});

function warningInput(loanId: string, btcPrice: number) {
  return {
    loanId,
    collateralAsset: "DCR" as const,
    collateralAmount: 100,
    borrowAsset: "BTC" as const,
    borrowAmount: 1,
    collateralPrices: prices("DCR", [20]),
    borrowAssetPrices: prices("BTC", [btcPrice]),
    now,
  };
}
