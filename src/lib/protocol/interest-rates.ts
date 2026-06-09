import type { BorrowAsset } from "./assets";
import type { SupplierFill } from "./supplier-offers";

export interface InterestRateConfig {
  borrowAsset: BorrowAsset;
  minimumAprBps: number;
  maximumAprBps: number;
  protocolSpreadBps: number;
  durationPremiumBps: number;
  collateralRiskPremiumBps: number;
}

export interface InterestRateQuote {
  borrowAsset: BorrowAsset;
  weightedSupplierAprBps: number;
  borrowerAprBps: number;
  protocolSpreadBps: number;
  durationPremiumBps: number;
  collateralRiskPremiumBps: number;
}

export function calculateWeightedSupplierAprBps(fills: SupplierFill[]): number {
  const totalFilled = fills.reduce((sum, fill) => sum + fill.amount, 0);

  if (totalFilled <= 0) {
    throw new Error("At least one positive supplier fill is required.");
  }

  return fills.reduce((sum, fill) => sum + fill.aprBps * (fill.amount / totalFilled), 0);
}

export function calculateBorrowerAprQuote(
  fills: SupplierFill[],
  config: InterestRateConfig,
): InterestRateQuote {
  if (fills.length === 0) {
    throw new Error("At least one supplier fill is required to quote borrower APR.");
  }

  for (const fill of fills) {
    if (fill.borrowAsset !== config.borrowAsset) {
      throw new Error("All supplier fills must match the configured borrow asset.");
    }
  }

  const weightedSupplierAprBps = calculateWeightedSupplierAprBps(fills);
  const rawBorrowerAprBps =
    weightedSupplierAprBps +
    config.protocolSpreadBps +
    config.durationPremiumBps +
    config.collateralRiskPremiumBps;

  const borrowerAprBps = Math.min(
    config.maximumAprBps,
    Math.max(config.minimumAprBps, rawBorrowerAprBps),
  );

  return {
    borrowAsset: config.borrowAsset,
    weightedSupplierAprBps,
    borrowerAprBps,
    protocolSpreadBps: config.protocolSpreadBps,
    durationPremiumBps: config.durationPremiumBps,
    collateralRiskPremiumBps: config.collateralRiskPremiumBps,
  };
}
