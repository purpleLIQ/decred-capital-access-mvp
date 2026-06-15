import { describe, expect, it } from "vitest";

import { createBorrowerProtocolQuoteSummary } from "../borrower-protocol-quote";
import { allocateRepaymentAcrossSupplierPositions } from "../supplier-repayment-allocation";
import { createSupplierPositionPreviewsFromAcceptedQuote } from "../supplier-position-previews";
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
];

function createPositions() {
  const quote = createBorrowerProtocolQuoteSummary({
    collateralDcr: 100,
    borrowAmount: 1_000,
    borrowAsset: "USDC",
    offers,
  });

  return createSupplierPositionPreviewsFromAcceptedQuote({
    quote,
    loanId: "loan-accepted-1",
    borrowerLoanRef: "DCL-001",
  }).positions;
}

describe("allocateRepaymentAcrossSupplierPositions", () => {
  it("allocates repayment pro-rata by supplier total due", () => {
    const positions = createPositions();
    const preview = allocateRepaymentAcrossSupplierPositions({ positions, repaymentAmount: 500 });
    const totalDue = positions[0].totalDue + positions[1].totalDue;

    expect(preview.status).toBe("partially_repaid");
    expect(preview.allocations).toHaveLength(2);
    expect(preview.allocations[0].repaymentAllocated).toBeCloseTo(500 * (positions[0].totalDue / totalDue));
    expect(preview.allocations[1].repaymentAllocated).toBeCloseTo(500 * (positions[1].totalDue / totalDue));
    expect(preview.totalAllocated).toBeCloseTo(500);
    expect(preview.remainingDue).toBeCloseTo(preview.totalDue - 500);
  });

  it("tracks principal interest received remaining and supplier share", () => {
    const positions = createPositions();
    const preview = allocateRepaymentAcrossSupplierPositions({ positions, repaymentAmount: 500 });
    const allocation = preview.allocations[0];

    expect(allocation.positionId).toBe(positions[0].id);
    expect(allocation.supplierOfferId).toBe(positions[0].supplierOfferId);
    expect(allocation.fillId).toBe(positions[0].fillId);
    expect(allocation.principalDue).toBe(positions[0].principal);
    expect(allocation.interestDue).toBe(positions[0].interestDue);
    expect(allocation.totalDue).toBe(positions[0].totalDue);
    expect(allocation.repaymentReceived).toBe(allocation.repaymentAllocated);
    expect(allocation.remainingDue).toBeCloseTo(allocation.totalDue - allocation.repaymentReceived);
    expect(allocation.supplierShareBps).toBeGreaterThan(0);
  });

  it("caps allocation at total due and leaves overpayment unallocated", () => {
    const positions = createPositions();
    const totalDue = positions[0].totalDue + positions[1].totalDue;
    const preview = allocateRepaymentAcrossSupplierPositions({ positions, repaymentAmount: totalDue + 250 });

    expect(preview.status).toBe("repaid");
    expect(preview.totalAllocated).toBeCloseTo(totalDue);
    expect(preview.unallocatedAmount).toBeCloseTo(250);
    expect(preview.remainingDue).toBe(0);
    expect(preview.allocations.every((allocation) => allocation.status === "repaid")).toBe(true);
  });

  it("returns unpaid allocation rows for zero repayment", () => {
    const positions = createPositions();
    const preview = allocateRepaymentAcrossSupplierPositions({ positions, repaymentAmount: 0 });

    expect(preview.status).toBe("unpaid");
    expect(preview.totalAllocated).toBe(0);
    expect(preview.allocations.every((allocation) => allocation.repaymentAllocated === 0)).toBe(true);
    expect(preview.allocations.every((allocation) => allocation.status === "unpaid")).toBe(true);
  });

  it("returns a waiting state when no positions exist", () => {
    const preview = allocateRepaymentAcrossSupplierPositions({ positions: [], repaymentAmount: 500 });

    expect(preview.status).toBe("waiting_for_positions");
    expect(preview.totalAllocated).toBe(0);
    expect(preview.unallocatedAmount).toBe(500);
    expect(preview.allocations).toEqual([]);
    expect(preview.notes).toContain("No supplier positions are ready for repayment allocation.");
  });
});
