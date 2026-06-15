import { describe, expect, it } from "vitest";

import { createBorrowerProtocolQuoteSummary } from "../borrower-protocol-quote";
import type { DemoSupplierOffer } from "../supplier-demo-data";

const offers: DemoSupplierOffer[] = [
  {
    id: "supplier-offer-a",
    supplierId: "supplier-a",
    borrowAsset: "USDC",
    availableAmount: 700,
    aprBps: 1200,
    minFillAmount: 100,
    maxDurationDays: 30,
    status: "active",
  },
  {
    id: "supplier-offer-b",
    supplierId: "supplier-b",
    borrowAsset: "USDC",
    availableAmount: 300,
    aprBps: 1800,
    minFillAmount: 100,
    maxDurationDays: 30,
    status: "active",
  },
  {
    id: "supplier-offer-paused",
    supplierId: "supplier-paused",
    borrowAsset: "USDC",
    availableAmount: 1_000,
    aprBps: 500,
    minFillAmount: 100,
    maxDurationDays: 30,
    status: "paused",
  },
];

describe("createBorrowerProtocolQuoteSummary", () => {
  it("derives borrower quote supplier fills from shared demo offers", () => {
    const quote = createBorrowerProtocolQuoteSummary({
      collateralDcr: 100,
      borrowAmount: 1_000,
      borrowAsset: "USDC",
      offers,
    });

    expect(quote.supplierFills.map((fill) => fill.supplierOfferId)).toEqual(["supplier-offer-a", "supplier-offer-b"]);
    expect(quote.supplierFills.map((fill) => fill.supplierId)).toEqual(["supplier-a", "supplier-b"]);
    expect(quote.supplierFilledAmount).toBe(1_000);
    expect(quote.supplierRemainingAmount).toBe(0);
    expect(quote.activeSupplierCapacity).toBe(1_000);
    expect(quote.fundingStatus).toBe("funded");
  });

  it("keeps blended APR based on allocated supplier offers", () => {
    const quote = createBorrowerProtocolQuoteSummary({
      collateralDcr: 100,
      borrowAmount: 1_000,
      borrowAsset: "USDC",
      offers,
    });

    expect(quote.weightedSupplierAprBps).toBe(1_380);
    expect(quote.borrowerAprBps).toBe(1_530);
  });

  it("keeps the one percent DCR platform fee values unchanged", () => {
    const quote = createBorrowerProtocolQuoteSummary({
      collateralDcr: 100,
      borrowAmount: 1_000,
      borrowAsset: "USDC",
      offers,
    });

    expect(quote.platformFeeRateBps).toBe(100);
    expect(quote.totalPlatformFeeDcr).toBe(1);
    expect(quote.platformFeeDcr).toBeCloseTo(0.7);
    expect(quote.arbiterReserveDcr).toBeCloseTo(0.3);
    expect(quote.collateralRequiredWithFeeDcr).toBe(101);
  });

  it("surfaces partial funding when active supplier capacity is short", () => {
    const quote = createBorrowerProtocolQuoteSummary({
      collateralDcr: 100,
      borrowAmount: 1_500,
      borrowAsset: "USDC",
      offers,
    });

    expect(quote.supplierFilledAmount).toBe(1_000);
    expect(quote.supplierRemainingAmount).toBe(500);
    expect(quote.fundingStatus).toBe("partially_filled");
    expect(quote.fundingProgressBps).toBeCloseTo(6_666.666667);
  });
});
