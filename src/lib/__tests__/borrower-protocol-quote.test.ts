import { describe, expect, it } from "vitest";

import { createBorrowerProtocolQuoteSummary } from "../borrower-protocol-quote";

describe("borrower protocol quote adapter", () => {
  it("attaches supplier-backed protocol math to borrower quote inputs", () => {
    const summary = createBorrowerProtocolQuoteSummary({
      collateralDcr: 100,
      borrowAmount: 350,
      borrowAsset: "USDC",
    });

    expect(summary.loanRequestId).toBe("borrower-demo-quote");
    expect(summary.fundingStatus).toBe("funded");
    expect(summary.activationEligible).toBe(true);
    expect(summary.fundingProgressBps).toBe(10_000);
    expect(summary.supplierFillCount).toBe(2);
    expect(summary.supplierFilledAmount).toBe(350);
    expect(summary.platformFeeDcr).toBeCloseTo(0.7);
    expect(summary.arbiterReserveDcr).toBeCloseTo(0.3);
    expect(summary.collateralRequiredWithFeeDcr).toBe(101);
  });

  it("surfaces borrower-visible supplier fill progress", () => {
    const summary = createBorrowerProtocolQuoteSummary({
      collateralDcr: 100,
      borrowAmount: 350,
      borrowAsset: "USDC",
    });

    expect(summary.supplierFills).toHaveLength(2);
    expect(summary.supplierFills[0]).toMatchObject({
      fillId: "borrower-demo-fill-1",
      supplierId: "supplier-demo-1",
      amount: 227.5,
      status: "reserved",
    });
    expect(summary.supplierFills[0].fundingShareBps).toBeCloseTo(6500);
    expect(summary.supplierFills[1].fundingShareBps).toBeCloseTo(3500);
  });

  it("keeps the next step focused on borrower and supplier integration", () => {
    const summary = createBorrowerProtocolQuoteSummary({
      collateralDcr: 100,
      borrowAmount: 350,
      borrowAsset: "USDC",
    });

    expect(summary.nextBuildStep).toBe("Connect live supplier offers and partial-fill progress to this borrower quote flow.");
    expect(summary.notes).toContain("Next product step is supplier offer creation and supplier position visibility.");
  });
});
