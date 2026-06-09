import type { CollateralAsset } from "./assets";

export interface PlatformFeeConfig {
  collateralAsset: CollateralAsset;
  platformFeeBps: number;
  platformShareBps: number;
  arbiterReserveShareBps: number;
}

export interface PlatformFeeBreakdown {
  collateralAsset: CollateralAsset;
  collateralAmount: number;
  totalFeeAmount: number;
  platformAmount: number;
  arbiterReserveAmount: number;
}

export const DEFAULT_PLATFORM_FEE_CONFIG: PlatformFeeConfig = {
  collateralAsset: "DCR",
  platformFeeBps: 100,
  platformShareBps: 7000,
  arbiterReserveShareBps: 3000,
};

const BPS_DENOMINATOR = 10_000;

export function validatePlatformFeeConfig(config: PlatformFeeConfig): void {
  if (config.collateralAsset !== "DCR") {
    throw new Error("DCR is the only supported collateral asset for v0.");
  }

  if (config.platformFeeBps < 0) {
    throw new Error("Platform fee bps must be non-negative.");
  }

  const totalShareBps = config.platformShareBps + config.arbiterReserveShareBps;

  if (totalShareBps !== BPS_DENOMINATOR) {
    throw new Error("Platform and arbiter reserve shares must total 10000 bps.");
  }
}

export function calculatePlatformFeeBreakdown(
  collateralAmount: number,
  config: PlatformFeeConfig = DEFAULT_PLATFORM_FEE_CONFIG,
): PlatformFeeBreakdown {
  validatePlatformFeeConfig(config);

  if (collateralAmount < 0) {
    throw new Error("Collateral amount must be non-negative.");
  }

  const totalFeeAmount = (collateralAmount * config.platformFeeBps) / BPS_DENOMINATOR;
  const platformAmount = (totalFeeAmount * config.platformShareBps) / BPS_DENOMINATOR;
  const arbiterReserveAmount = totalFeeAmount - platformAmount;

  return {
    collateralAsset: config.collateralAsset,
    collateralAmount,
    totalFeeAmount,
    platformAmount,
    arbiterReserveAmount,
  };
}
