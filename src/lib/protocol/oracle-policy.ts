import type { BorrowAsset, CollateralAsset } from "./assets";
import type { LiquidationPhase } from "./liquidation-states";

export type OracleSourceStatus = "healthy" | "stale" | "missing" | "divergent";
export type HealthDecision = "healthy" | "warning" | "top_up_required" | "arbiter_review" | "fallback_review_blocked";

export interface PricePoint {
  source: string;
  observedAt: string;
  asset: CollateralAsset | BorrowAsset | "USD";
  usdPrice: number;
}

export interface OraclePolicyConfig {
  policyVersion: string;
  maxOracleAgeMs: number;
  maxSourceDivergenceBps: number;
  warningLtvBps: number;
  topUpLtvBps: number;
  arbiterReviewLtvBps: number;
  fallbackReviewLtvBps: number;
  automaticFallbackEnabled: false;
}

export interface LoanHealthInput {
  loanId: string;
  collateralAsset: CollateralAsset;
  collateralAmount: number;
  borrowAsset: BorrowAsset;
  borrowAmount: number;
  collateralPrices: PricePoint[];
  borrowAssetPrices: PricePoint[];
  now: string;
  config: OraclePolicyConfig;
}

export interface OracleSourceSummary {
  asset: CollateralAsset | BorrowAsset;
  status: OracleSourceStatus;
  medianUsdPrice: number;
  sourceCount: number;
  maxAgeMs: number;
  divergenceBps: number;
  blockers: string[];
  warnings: string[];
}

export interface LoanHealthEvaluation {
  loanId: string;
  policyVersion: string;
  collateralAsset: CollateralAsset;
  borrowAsset: BorrowAsset;
  collateralValueUsd: number;
  borrowValueUsd: number;
  ltvBps: number;
  decision: HealthDecision;
  phase: LiquidationPhase;
  collateralOracle: OracleSourceSummary;
  borrowOracle: OracleSourceSummary;
  warnings: string[];
  blockers: string[];
  automaticFallbackAllowed: false;
}

export const DEFAULT_ORACLE_POLICY_CONFIG: OraclePolicyConfig = {
  policyVersion: "oracle-policy-v0",
  maxOracleAgeMs: 5 * 60 * 1000,
  maxSourceDivergenceBps: 250,
  warningLtvBps: 6500,
  topUpLtvBps: 7000,
  arbiterReviewLtvBps: 7500,
  fallbackReviewLtvBps: 8500,
  automaticFallbackEnabled: false,
};

export function evaluateLoanHealth(input: LoanHealthInput): LoanHealthEvaluation {
  const collateralOracle = summarizeOracleSources({
    asset: input.collateralAsset,
    prices: input.collateralPrices,
    now: input.now,
    config: input.config,
  });
  const borrowOracle = summarizeOracleSources({
    asset: input.borrowAsset,
    prices: input.borrowAssetPrices,
    now: input.now,
    config: input.config,
  });
  const blockers = [...collateralOracle.blockers, ...borrowOracle.blockers];
  const warnings = [...collateralOracle.warnings, ...borrowOracle.warnings];
  const collateralValueUsd = input.collateralAmount * collateralOracle.medianUsdPrice;
  const borrowValueUsd = input.borrowAmount * borrowOracle.medianUsdPrice;
  const ltvBps = collateralValueUsd > 0 ? (borrowValueUsd / collateralValueUsd) * 10_000 : 0;
  const decision = resolveHealthDecision({ ltvBps, blockers, config: input.config });

  return {
    loanId: input.loanId,
    policyVersion: input.config.policyVersion,
    collateralAsset: input.collateralAsset,
    borrowAsset: input.borrowAsset,
    collateralValueUsd,
    borrowValueUsd,
    ltvBps,
    decision,
    phase: phaseForDecision(decision),
    collateralOracle,
    borrowOracle,
    warnings,
    blockers,
    automaticFallbackAllowed: false,
  };
}

export function summarizeOracleSources(input: {
  asset: CollateralAsset | BorrowAsset;
  prices: PricePoint[];
  now: string;
  config: OraclePolicyConfig;
}): OracleSourceSummary {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (input.prices.length === 0) {
    blockers.push(`Missing oracle prices for ${input.asset}.`);
    return {
      asset: input.asset,
      status: "missing",
      medianUsdPrice: 0,
      sourceCount: 0,
      maxAgeMs: 0,
      divergenceBps: 0,
      blockers,
      warnings,
    };
  }

  const prices = input.prices.map((price) => price.usdPrice).sort((a, b) => a - b);
  const medianUsdPrice = median(prices);
  const maxAgeMs = Math.max(...input.prices.map((price) => Date.parse(input.now) - Date.parse(price.observedAt)));
  const divergenceBps = calculateDivergenceBps(prices);

  if (input.prices.some((price) => price.usdPrice <= 0)) {
    blockers.push(`Oracle price for ${input.asset} must be positive.`);
  }

  if (maxAgeMs > input.config.maxOracleAgeMs) {
    blockers.push(`Oracle prices for ${input.asset} are stale.`);
  }

  if (divergenceBps > input.config.maxSourceDivergenceBps) {
    blockers.push(`Oracle prices for ${input.asset} diverge beyond policy.`);
  }

  const status: OracleSourceStatus =
    blockers.length === 0
      ? "healthy"
      : blockers.some((blocker) => blocker.includes("Missing"))
        ? "missing"
        : blockers.some((blocker) => blocker.includes("stale"))
          ? "stale"
          : "divergent";

  return {
    asset: input.asset,
    status,
    medianUsdPrice,
    sourceCount: input.prices.length,
    maxAgeMs,
    divergenceBps,
    blockers,
    warnings,
  };
}

function resolveHealthDecision(input: {
  ltvBps: number;
  blockers: string[];
  config: OraclePolicyConfig;
}): HealthDecision {
  if (input.blockers.length > 0) {
    return "fallback_review_blocked";
  }

  if (input.ltvBps >= input.config.fallbackReviewLtvBps) {
    return "fallback_review_blocked";
  }

  if (input.ltvBps >= input.config.arbiterReviewLtvBps) {
    return "arbiter_review";
  }

  if (input.ltvBps >= input.config.topUpLtvBps) {
    return "top_up_required";
  }

  if (input.ltvBps >= input.config.warningLtvBps) {
    return "warning";
  }

  return "healthy";
}

function phaseForDecision(decision: HealthDecision): LiquidationPhase {
  switch (decision) {
    case "healthy":
      return "healthy";
    case "warning":
      return "warning_window";
    case "top_up_required":
      return "top_up_window";
    case "arbiter_review":
      return "arbiter_intervention";
    case "fallback_review_blocked":
      return "fallback_liquidation_review";
  }
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const midpoint = Math.floor(values.length / 2);

  return values.length % 2 === 0 ? (values[midpoint - 1] + values[midpoint]) / 2 : values[midpoint];
}

function calculateDivergenceBps(values: number[]): number {
  if (values.length <= 1) {
    return 0;
  }

  const min = values[0];
  const max = values[values.length - 1];
  const mid = median(values);

  return mid > 0 ? ((max - min) / mid) * 10_000 : 0;
}
