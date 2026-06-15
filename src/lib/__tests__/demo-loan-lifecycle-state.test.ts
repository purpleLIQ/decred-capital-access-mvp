import { describe, expect, it } from "vitest";

import { createDemoLoanLifecycleState } from "../demo-loan-lifecycle-state";
import type { DemoSupplierOffer } from "../supplier-demo-data";

const baseOffers: DemoSupplierOffer[] = [
  {
    id: "supplier-offer-a",
    supplierId: "supplier-a",
    borrowAsset: "USDC",
    availableAmount: 1_000,
    aprBps: 1200,
    minFillAmount: 100,
    maxDurationDays: 30,
    status: "active",
  },
  {
    id: "supplier-offer-b",
    supplierId: "supplier-b",
    borrowAsset: "USDC",
    availableAmount: 500,
    aprBps: 1600,
    minFillAmount: 100,
    maxDurationDays: 30,
    status: "active",
  },
];

function createLifecycle(overrides: Partial<Parameters<typeof createDemoLoanLifecycleState>[0]> = {}) {
  return createDemoLoanLifecycleState({
    borrowerId: "borrower-demo",
    borrowerLoanRef: "DCL-001",
    loanId: "loan-demo-1",
    collateralDcr: 200,
    borrowAmount: 1_000,
    borrowAsset: "USDC",
    durationDays: 30,
    borrowerAcceptedPartialFunding: false,
    repaymentAmount: 500,
    offers: baseOffers,
    ...overrides,
  });
}

describe("createDemoLoanLifecycleState", () => {
  it("assembles quote positions and repayment allocation from one lifecycle adapter", () => {
    const lifecycle = createLifecycle();

    expect(lifecycle.borrowerId).toBe("borrower-demo");
    expect(lifecycle.borrowerLoanRef).toBe("DCL-001");
    expect(lifecycle.loanId).toBe("loan-demo-1");
    expect(lifecycle.stage).toBe("repayment_previewed");
    expect(lifecycle.quote.fundingStatus).toBe("funded");
    expect(lifecycle.supplierPositions.positions).toHaveLength(1);
    expect(lifecycle.repaymentAllocation.allocations).toHaveLength(1);
  });

  it("keeps reserved partial fills from becoming positions without explicit borrower partial acceptance", () => {
    const lifecycle = createLifecycle({ borrowAmount: 2_000 });

    expect(lifecycle.quote.fundingStatus).toBe("partially_filled");
    expect(lifecycle.quote.supplierFillCount).toBe(2);
    expect(lifecycle.supplierPositions.positions).toEqual([]);
    expect(lifecycle.repaymentAllocation.allocations).toEqual([]);
    expect(lifecycle.stage).toBe("liquidity_reserved");
  });

  it("moves partial accepted quotes into repayment preview when borrower acceptance is explicit", () => {
    const lifecycle = createLifecycle({ borrowAmount: 2_000, borrowerAcceptedPartialFunding: true });

    expect(lifecycle.quote.fundingStatus).toBe("partially_filled");
    expect(lifecycle.supplierPositions.positions).toHaveLength(2);
    expect(lifecycle.repaymentAllocation.allocations).toHaveLength(2);
    expect(lifecycle.stage).toBe("repayment_previewed");
  });

  it("keeps zero-fill quotes in quote requested state", () => {
    const lifecycle = createLifecycle({ borrowAsset: "USDT", offers: baseOffers });

    expect(lifecycle.quote.supplierFillCount).toBe(0);
    expect(lifecycle.supplierPositions.positions).toEqual([]);
    expect(lifecycle.repaymentAllocation.allocations).toEqual([]);
    expect(lifecycle.stage).toBe("quote_requested");
  });

  it("documents replaceable adapter boundaries for production integration", () => {
    const lifecycle = createLifecycle();

    expect(lifecycle.adapterBoundaries).toContain(
      "Supplier offer source is still demo-backed and can later be replaced by persistent supplier account state.",
    );
    expect(lifecycle.adapterBoundaries).toContain(
      "Repayment amount is a deterministic preview input and can later come from chain watcher events.",
    );
    expect(lifecycle.nextIntegrationSteps).toContain(
      "Persist accepted quote, supplier fills, and supplier positions as lifecycle records.",
    );
  });
});
