import { describe, expect, it } from "vitest";
import {
  buildPreviewQuote,
  calculateBorrowFromLtv,
  calculateCollateralFromBorrow,
  calculateLtvBpsFromValues,
} from "../quote-math";

describe("quote math helpers", () => {
  it("calculates borrow amount from collateral and target LTV", () => {
    expect(calculateBorrowFromLtv(100, 12.5, 3500)).toBe(437.5);
  });

  it("calculates DCR collateral from borrow amount and target LTV", () => {
    expect(calculateCollateralFromBorrow(350, 12.5, 3500)).toBe(80);
  });

  it("calculates LTV from custom borrow and collateral values", () => {
    expect(calculateLtvBpsFromValues(350, 100, 12.5)).toBe(2800);
  });

  it("builds a preview quote with fee and LTV fields", () => {
    const quote = buildPreviewQuote({ collateralDcr: 100, borrowAmount: 350, borrowAsset: "USDC", dcrUsd: 12.5 });

    expect(quote.ltvBps).toBe(2800);
    expect(quote.originationFee).toBe(3.5);
    expect(quote.maxBorrowAt35Ltv).toBe(437.5);
  });
});
