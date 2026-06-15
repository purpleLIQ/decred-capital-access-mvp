import { describe, expect, it } from "vitest";

import {
  createHeadlessLoanLifecycleRecord,
  findHeadlessLoanLifecycleByLookupCode,
  treasuryRequestThresholdUsd,
} from "../headless-loan-lifecycle";
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

describe("createHeadlessLoanLifecycleRecord", () => {
  it("creates a production-shaped accountless borrower lifecycle record", () => {
    const record = createHeadlessLoanLifecycleRecord({
      collateralDcr: 100,
      borrowAmount: 1_000,
      borrowAsset: "USDC",
      borrowerAcceptedQuote: true,
      repaymentAmount: 500,
      offers,
    });

    expect(record.loanId).toContain(record.publicLoanReference.toLowerCase());
    expect(record.lookupCode).toBe(record.publicLoanReference);
    expect(record.borrowerContact.preference).toBe("none");
    expect(record.quoteStatus).toBe("accepted");
    expect(record.fundingStatus).toBe("funded");
    expect(record.acceptedSupplierFills).toHaveLength(2);
    expect(record.supplierPositions).toHaveLength(2);
    expect(record.repaymentAllocationPreview.allocations).toHaveLength(2);
    expect(record.lifecycleStatus).toBe("awaiting_collateral_lock");
    expect(record.nextBorrowerAction).toContain("lookup code");
  });

  it("stores optional borrower contact for updates without requiring account creation", () => {
    const record = createHeadlessLoanLifecycleRecord({
      collateralDcr: 100,
      borrowAmount: 1_000,
      borrowAsset: "USDC",
      borrowerAcceptedQuote: true,
      borrowerContact: { value: "borrower@example.com" },
      offers,
    });

    expect(record.borrowerContact).toMatchObject({
      preference: "email",
      value: "borrower@example.com",
      consentForUpdates: true,
    });
    expect(record.borrowerContact.note).toContain("not account creation");
  });

  it("keeps unaccepted quotes from creating accepted fills or positions", () => {
    const record = createHeadlessLoanLifecycleRecord({
      collateralDcr: 100,
      borrowAmount: 1_000,
      borrowAsset: "USDC",
      borrowerAcceptedQuote: false,
      offers,
    });

    expect(record.quoteStatus).toBe("quoted");
    expect(record.acceptedSupplierFills).toEqual([]);
    expect(record.supplierPositions).toEqual([]);
    expect(record.repaymentAllocationPreview.allocations).toEqual([]);
    expect(record.lifecycleStatus).toBe("quote_created");
  });

  it("routes large supplier-backed requests through mixed supplier treasury review", () => {
    const record = createHeadlessLoanLifecycleRecord({
      collateralDcr: 5_000,
      borrowAmount: treasuryRequestThresholdUsd + 1,
      borrowAsset: "USDC",
      requestedAmountUsd: treasuryRequestThresholdUsd + 1,
      borrowerAcceptedQuote: true,
      offers: [
        {
          id: "large-offer",
          supplierId: "supplier-large",
          borrowAsset: "USDC",
          availableAmount: treasuryRequestThresholdUsd + 1,
          aprBps: 1400,
          minFillAmount: 100,
          maxDurationDays: 30,
          status: "active",
        },
      ],
    });

    expect(record.fundingRoute.status).toBe("mixed_supplier_treasury");
    expect(record.fundingRoute.treasuryReviewRequired).toBe(true);
  });

  it("routes large requests with no supplier liquidity to treasury review", () => {
    const record = createHeadlessLoanLifecycleRecord({
      collateralDcr: 5_000,
      borrowAmount: treasuryRequestThresholdUsd + 1,
      borrowAsset: "USDC",
      requestedAmountUsd: treasuryRequestThresholdUsd + 1,
      borrowerAcceptedQuote: true,
      offers: [],
    });

    expect(record.fundingRoute.status).toBe("treasury_review");
    expect(record.nextSupplierOperatorAction).toContain("treasury/public funding path");
  });

  it("includes typed placeholders for future wallet watcher arbiter evidence and release workflows", () => {
    const record = createHeadlessLoanLifecycleRecord({
      collateralDcr: 100,
      borrowAmount: 1_000,
      borrowAsset: "USDC",
      borrowerAcceptedQuote: true,
      offers,
    });

    expect(record.collateralLock.status).toBe("awaiting_borrower");
    expect(record.dcrPlatformFeeOutput.status).toBe("previewed");
    expect(record.supplierDisbursement.status).toBe("ready");
    expect(record.repaymentDetection.status).toBe("watcher_placeholder");
    expect(record.collateralRelease.status).toBe("blocked");
    expect(record.liquidationHealth.status).toBe("healthy");
    expect(record.arbiterReview.status).toBe("available");
    expect(record.evidenceBundle.commitmentScheme).toBe("sha256_placeholder");
  });
});

describe("findHeadlessLoanLifecycleByLookupCode", () => {
  it("finds records by public lookup code without account identity", () => {
    const record = createHeadlessLoanLifecycleRecord({
      publicLoanReference: "DCL-LOOKUP-001",
      collateralDcr: 100,
      borrowAmount: 1_000,
      borrowAsset: "USDC",
      borrowerAcceptedQuote: true,
      offers,
    });

    expect(findHeadlessLoanLifecycleByLookupCode("dcl-lookup-001", [record])).toBe(record);
    expect(findHeadlessLoanLifecycleByLookupCode("missing", [record])).toBeNull();
  });
});
