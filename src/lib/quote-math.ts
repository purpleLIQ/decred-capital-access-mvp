import type { Loan, Quote } from "./types";

export function calculateCollateralUsd(collateralDcr: number, dcrUsd: number): number {
  return Number((collateralDcr * dcrUsd).toFixed(2));
}

export function calculateLtvBpsFromValues(borrowAmount: number, collateralDcr: number, dcrUsd: number): number {
  const collateralUsd = calculateCollateralUsd(collateralDcr, dcrUsd);
  if (borrowAmount <= 0 || collateralUsd <= 0) return 0;
  return Math.round((borrowAmount / collateralUsd) * 10000);
}

export function calculateBorrowFromLtv(collateralDcr: number, dcrUsd: number, ltvBps: number): number {
  const collateralUsd = calculateCollateralUsd(collateralDcr, dcrUsd);
  return Number(((collateralUsd * ltvBps) / 10000).toFixed(2));
}

export function calculateCollateralFromBorrow(borrowAmount: number, dcrUsd: number, ltvBps: number): number {
  if (borrowAmount <= 0 || dcrUsd <= 0 || ltvBps <= 0) return 0;
  return Number(((borrowAmount / (ltvBps / 10000)) / dcrUsd).toFixed(4));
}

export function buildPreviewQuote(input: {
  collateralDcr: number;
  borrowAmount: number;
  borrowAsset: Loan["borrowAsset"];
  dcrUsd: number;
}): Quote {
  const collateralUsd = calculateCollateralUsd(input.collateralDcr, input.dcrUsd);
  const ltvBps = calculateLtvBpsFromValues(input.borrowAmount, input.collateralDcr, input.dcrUsd);
  const warnings: string[] = [];

  if (ltvBps > 3500) warnings.push("Above the 35% target LTV.");
  if (input.borrowAsset !== "USDC") warnings.push("USDC is the recommended demo asset.");

  return {
    collateralDcr: input.collateralDcr,
    borrowAmount: input.borrowAmount,
    borrowAsset: input.borrowAsset,
    dcrUsd: input.dcrUsd,
    collateralUsd,
    ltvBps,
    maxBorrowAt35Ltv: Number((collateralUsd * 0.35).toFixed(2)),
    liquidationThresholdBps: 7000,
    originationFee: Number((input.borrowAmount * 0.01).toFixed(2)),
    estimatedAprBps: 1450,
    protocolQuote: undefined,
    warnings,
  };
}
