import type { MarketSnapshot, Quote, RiskLevel } from "./types";

export function calculateLtvBps(borrowAmount: number, collateralUsd: number): number {
  if (borrowAmount <= 0 || collateralUsd <= 0) {
    return 0;
  }

  return Math.round((borrowAmount / collateralUsd) * 10000);
}

export function classifyRisk(ltvBps: number): RiskLevel {
  if (ltvBps >= 7000) return "liquidation";
  if (ltvBps >= 6000) return "warning";
  if (ltvBps >= 4500) return "watch";
  return "healthy";
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function blendPrices(prices: number[]): { price: number; warnings: string[] } {
  const usable = prices.filter((price) => Number.isFinite(price) && price > 0);
  if (usable.length === 0) {
    return { price: 12.13, warnings: ["Using demo fallback DCR price because no live source responded."] };
  }

  const sorted = usable.toSorted((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const divergent = sorted.some((price) => Math.abs(price - median) / median > 0.08);

  return {
    price: Number(median.toFixed(4)),
    warnings: divergent
      ? ["One or more price sources diverged by more than 8%; operator review is required."]
      : [],
  };
}

export function buildQuote(input: {
  collateralDcr: number;
  borrowAmount: number;
  borrowAsset: Quote["borrowAsset"];
  market: MarketSnapshot;
}): Quote {
  const collateralUsd = Number((input.collateralDcr * input.market.dcrUsd).toFixed(2));
  const ltvBps = calculateLtvBps(input.borrowAmount, collateralUsd);
  const maxBorrowAt35Ltv = Number((collateralUsd * 0.35).toFixed(2));
  const warnings: string[] = [];

  if (ltvBps > 3500) {
    warnings.push("This quote is above the 35% demo LTV target.");
  }
  if (input.market.dcrdexStableBookEmpty) {
    warnings.push("DCRDEX stablecoin liquidity is thin, so liquidation remains manual in v1.");
  }
  if (input.borrowAsset !== "USDC") {
    warnings.push("USDC is the recommended demo borrow asset; other assets are roadmap items.");
  }

  return {
    collateralDcr: input.collateralDcr,
    borrowAmount: input.borrowAmount,
    borrowAsset: input.borrowAsset,
    dcrUsd: input.market.dcrUsd,
    collateralUsd,
    ltvBps,
    maxBorrowAt35Ltv,
    liquidationThresholdBps: 7000,
    originationFee: Number((input.borrowAmount * 0.01).toFixed(2)),
    estimatedAprBps: 1450,
    warnings,
  };
}

export function isOracleHealthy(market: MarketSnapshot): boolean {
  return !market.stale && market.sourceCount >= 2 && market.warnings.length < 3;
}
