export const protocolConfig = {
  demoMode: process.env.DEMO_MODE !== "false",
  collateralAsset: "DCR",
  recommendedBorrowAsset: "USDC",
  fallbackDcrUsd: 12.13,
  targetLtvBps: 3500,
  watchLtvBps: 4500,
  warningLtvBps: 6000,
  liquidationLtvBps: 7000,
  hardLiquidationLtvBps: 8000,
  originationFeeBps: 100,
  estimatedAprBps: 1450,
  defaultTermDays: 30,
  minLivePriceSources: 2,
  maxPriceDivergenceBps: 800,
  oracleRequestTimeoutMs: 3500,
  maxOracleWarningsForHealthy: 2,
  liquidationGracePeriodMinutes: 30,
  minLiquidationDexDepthUsd: 5000,
  maxLiquidationSlippageBps: 250,
  automationRequiresHealthyOracle: true,
} as const;

export type ProtocolConfig = typeof protocolConfig;

export function applyBps(amount: number, bps: number): number {
  return Number(((amount * bps) / 10000).toFixed(2));
}
