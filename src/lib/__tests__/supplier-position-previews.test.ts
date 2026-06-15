import { describe, expect, it } from "vitest";

import { createBorrowerProtocolQuoteSummary } from "../borrower-protocol-quote";
import {
  createAcceptedSupplierFillsFromQuote,
  createSupplierPositionPreviewsFromAcceptedQuote,
} from "../supplier-position-previews";
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

describe("createSupplierPositionPreviewsFromAcceptedQuote", () => {
  it("creates one supplier position preview per accepted full quote fill", () => {
    const quote = createBorrowerProtocolQuoteSummary({
      collateralDcr: 100,
      borrowAmount: 1_000,
      borrowAsset: "USDC",
      offers,
    });
    const preview = createSupplierPositionPreviewsFromAcceptedQuote({
      quote,
      loanId: "loan-accepted-1",
      borrowerLoanRef: "DCL-001",
      repaymentAddressBySupplierId: {
        "supplier-a": "repay-a",
        "supplier-b": "repay-b",
      },
    });

    expect(preview.status).toBe("ready_for_repayment_preview");
    expect(preview.acceptedFillCount).toBe(2);
    expect(preview.positions.map((position) => position.supplierId)).toEqual(["supplier-a", "supplier-b"]);
    expect(preview.positions[0]).toMatchObject({
      id: "position-borrower-demo-fill-1",
      supplierOfferId: "supplier-offer-a",
      fillId: "borrower-demo-fill-1",
      loanId: "loan-accepted-1",
      borrowerLoanRef: "DCL-001",
      principal: 700,
      aprBps: 1200,
      repaymentAddress: "repay-a",
      status: "preview",
    });
  });

  it("calculates each supplier interest from its own filled amount", () => {
    const quote = createBorrowerProtocolQuoteSummary({
      collateralDcr: 100,
      borrowAmount: 1_000,
      borrowAsset: "USDC",
      offers,
    });
    const preview = createSupplierPositionPreviewsFromAcceptedQuote({ quote });

    expect(preview.positions[0].interestDue).toBeCloseTo(700 * 0.12 * (30 / 365));
    expect(preview.positions[1].interestDue).toBeCloseTo(300 * 0.18 * (30 / 365));
    expect(preview.positions[0].totalDue).toBeCloseTo(preview.positions[0].principal + preview.positions[0].interestDue);
    expect(preview.totalPrincipal).toBe(1_000);
    expect(preview.totalInterestDue).toBeCloseTo(preview.positions[0].interestDue + preview.positions[1].interestDue);
    expect(preview.remainingDue).toBe(preview.totalDue);
  });

  it("does not activate partial quote fills without explicit borrower partial acceptance", () => {
    const quote = createBorrowerProtocolQuoteSummary({
      collateralDcr: 100,
      borrowAmount: 1_500,
      borrowAsset: "USDC",
      offers,
    });
    const preview = createSupplierPositionPreviewsFromAcceptedQuote({ quote });

    expect(quote.fundingStatus).toBe("partially_filled");
    expect(preview.status).toBe("waiting_for_liquidity");
    expect(preview.positions).toEqual([]);
    expect(preview.notes).toContain("Partial supplier fills are reserved, but no positions activate until the borrower accepts partial funding.");
  });

  it("creates partial supplier positions when borrower explicitly accepts partial funding", () => {
    const quote = createBorrowerProtocolQuoteSummary({
      collateralDcr: 100,
      borrowAmount: 1_500,
      borrowAsset: "USDC",
      offers,
    });
    const preview = createSupplierPositionPreviewsFromAcceptedQuote({
      quote,
      borrowerAcceptedPartialFunding: true,
    });

    expect(preview.status).toBe("ready_for_repayment_preview");
    expect(preview.acceptedFillCount).toBe(2);
    expect(preview.totalPrincipal).toBe(1_000);
    expect(preview.positions).toHaveLength(2);
  });

  it("creates no positions and returns a waiting state for zero fills", () => {
    const quote = createBorrowerProtocolQuoteSummary({
      collateralDcr: 100,
      borrowAmount: 1_000,
      borrowAsset: "USDT",
      offers,
    });
    const preview = createSupplierPositionPreviewsFromAcceptedQuote({ quote });

    expect(preview.status).toBe("waiting_for_liquidity");
    expect(preview.acceptedFillCount).toBe(0);
    expect(preview.positions).toEqual([]);
    expect(preview.notes).toContain("No supplier positions are available yet because this quote has no accepted fills.");
  });
});

describe("createAcceptedSupplierFillsFromQuote", () => {
  it("preserves supplier offer references for persistent adapters later", () => {
    const quote = createBorrowerProtocolQuoteSummary({
      collateralDcr: 100,
      borrowAmount: 1_000,
      borrowAsset: "USDC",
      offers,
    });
    const fills = createAcceptedSupplierFillsFromQuote(quote, "loan-accepted-1", "2026-06-10T12:05:00.000Z");

    expect(fills.map((fill) => fill.supplierOfferId)).toEqual(["supplier-offer-a", "supplier-offer-b"]);
    expect(fills.every((fill) => fill.loanRequestId === "loan-accepted-1")).toBe(true);
    expect(fills.every((fill) => fill.status === "reserved")).toBe(true);
  });
});
