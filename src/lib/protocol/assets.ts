export const COLLATERAL_ASSETS = ["DCR"] as const;
export type CollateralAsset = (typeof COLLATERAL_ASSETS)[number];

export const BORROW_ASSETS = ["BTC", "USDC", "USDT"] as const;
export type BorrowAsset = (typeof BORROW_ASSETS)[number];

export type SupportedAsset = CollateralAsset | BorrowAsset;

export function isCollateralAsset(asset: string): asset is CollateralAsset {
  return COLLATERAL_ASSETS.includes(asset as CollateralAsset);
}

export function isBorrowAsset(asset: string): asset is BorrowAsset {
  return BORROW_ASSETS.includes(asset as BorrowAsset);
}
