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
    expect(summary.supplierFillCount).toBe(1);
    expect(summary.supplierFilledAmount).toBe(350);
    expect(summary.platformFeeDcr).toBe(0.8);
    expect(summary.arbiterReserveDcr).toBe(0.2);
    expect(summary.collateralRequiredWithFeeDcr).toBe(101);
  });

  it("keeps the next step focused on borrower and supplier integration", () => {
    const summary = createBorrowerProtocolQuoteSummary({
      collateralDcr: 100,
      borrowAmount: 350,
      borrowAsset: "USDC",
    });

    expect(summary.nextBuildStep).toBe("Connect supplier offers and partial-fill progress to this borrower quote flow.");
    expect(summary.notes).toContain("Next product step is supplier fill visibility and supplier offer UX.");
  });
});
