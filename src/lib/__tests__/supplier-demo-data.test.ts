import { describe, expect, it } from "vitest";

import { allocateSupplierOffersToBorrowerRequest, type DemoSupplierOffer } from "../supplier-demo-data";

const offers: DemoSupplierOffer[] = [
  {
    id: "active-usdc-low",
    supplierId: "supplier-low",
    borrowAsset: "USDC",
    availableAmount: 600,
    aprBps: 1200,
    minFillAmount: 100,
    maxDurationDays: 30,
    status: "active",
  },
  {
    id: "paused-usdc",
    supplierId: "supplier-paused",
    borrowAsset: "USDC",
    availableAmount: 900,
    aprBps: 800,
    minFillAmount: 100,
    maxDurationDays: 30,
    status: "paused",
  },
  {
    id: "canceled-usdc",
    supplierId: "supplier-canceled",
    borrowAsset: "USDC",
    availableAmount: 900,
    aprBps: 700,
    minFillAmount: 100,
    maxDurationDays: 30,
    status: "canceled",
  },
  {
    id: "active-btc",
    supplierId: "supplier-btc",
    borrowAsset: "BTC",
    availableAmount: 1,
    aprBps: 500,
    minFillAmount: 0.01,
    maxDurationDays: 30,
    status: "active",
  },
  {
    id: "active-usdc-high",
    supplierId: "supplier-high",
    borrowAsset: "USDC",
    availableAmount: 500,
    aprBps: 1400,
    minFillAmount: 100,
    maxDurationDays: 30,
    status: "active",
  },
];

describe("allocateSupplierOffersToBorrowerRequest", () => {
  it("uses active matching offers and excludes paused, canceled, and mismatched assets", () => {
    const allocation = allocateSupplierOffersToBorrowerRequest({
      borrowAsset: "USDC",
      requestedAmount: 1_000,
      durationDays: 30,
      offers,
    });

    expect(allocation.fills.map((fill) => fill.supplierOfferId)).toEqual(["active-usdc-low", "active-usdc-high"]);
    expect(allocation.filledAmount).toBe(1_000);
    expect(allocation.remainingAmount).toBe(0);
    expect(allocation.status).toBe("funded");
  });

  it("creates partial funding when active capacity is insufficient", () => {
    const allocation = allocateSupplierOffersToBorrowerRequest({
      borrowAsset: "USDC",
      requestedAmount: 1_500,
      durationDays: 30,
      offers,
    });

    expect(allocation.activeCapacity).toBe(1_100);
    expect(allocation.filledAmount).toBe(1_100);
    expect(allocation.remainingAmount).toBe(400);
    expect(allocation.fundingProgressBps).toBeCloseTo(7_333.333333);
    expect(allocation.status).toBe("partially_filled");
  });

  it("creates funded status when active capacity is sufficient", () => {
    const allocation = allocateSupplierOffersToBorrowerRequest({
      borrowAsset: "USDC",
      requestedAmount: 700,
      durationDays: 30,
      offers,
    });

    expect(allocation.filledAmount).toBe(700);
    expect(allocation.remainingAmount).toBe(0);
    expect(allocation.fundingProgressBps).toBe(10_000);
    expect(allocation.status).toBe("funded");
  });
});
