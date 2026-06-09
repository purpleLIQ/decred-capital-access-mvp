import { describe, expect, it } from "vitest";

import {
  calculateBorrowerAprQuote,
  calculatePlatformFeeBreakdown,
  calculateWeightedSupplierAprBps,
  canActivateLoanFunding,
  createEvidencePublicSummary,
  createInitialLiquidationState,
  createLoanFundingState,
  createSupplierPositionsForLoan,
  type EvidenceBundle,
  type LoanRequest,
  type SupplierFill,
} from "..";

const request: LoanRequest = {
  id: "loan-request-1",
  borrowerId: "borrower-1",
  borrowAsset: "BTC",
  borrowAmount: 1,
  collateralAsset: "DCR",
  collateralAmount: 100,
  durationDays: 365,
  requiredFundingThresholdBps: 10_000,
  createdAt: "2026-06-09T00:00:00.000Z",
  fundingDeadline: "2026-06-10T00:00:00.000Z",
  borrowerAcceptedPartialFunding: false,
};

const fills: SupplierFill[] = [
  {
    id: "fill-a",
    loanRequestId: "loan-request-1",
    supplierOfferId: "offer-a",
    supplierId: "supplier-a",
    borrowAsset: "BTC",
    amount: 0.25,
    aprBps: 800,
    status: "reserved",
    reservedAt: "2026-06-09T01:00:00.000Z",
  },
  {
    id: "fill-b",
    loanRequestId: "loan-request-1",
    supplierOfferId: "offer-b",
    supplierId: "supplier-b",
    borrowAsset: "BTC",
    amount: 0.75,
    aprBps: 1000,
    status: "reserved",
    reservedAt: "2026-06-09T01:05:00.000Z",
  },
];

describe("protocol domain foundation", () => {
  it("tracks partial fills before the 100% v0 funding threshold is met", () => {
    const state = createLoanFundingState(request, [fills[0]]);

    expect(state.filledAmount).toBe(0.25);
    expect(state.remainingAmount).toBe(0.75);
    expect(state.fundingProgressBps).toBe(2500);
    expect(state.status).toBe("partially_filled");
    expect(canActivateLoanFunding(state)).toBe(false);
  });

  it("allows activation only after the required funding threshold is met", () => {
    const state = createLoanFundingState(request, fills);

    expect(state.filledAmount).toBe(1);
    expect(state.remainingAmount).toBe(0);
    expect(state.fundingProgressBps).toBe(10_000);
    expect(state.status).toBe("funded");
    expect(canActivateLoanFunding(state)).toBe(true);
  });

  it("creates supplier positions where suppliers earn only on the filled amount", () => {
    const positions = createSupplierPositionsForLoan({
      loanId: "loan-1",
      request,
      fills,
      startAt: "2026-06-09T02:00:00.000Z",
      repaymentAddressBySupplierId: {
        "supplier-a": "btc-repay-a",
        "supplier-b": "btc-repay-b",
      },
    });

    expect(positions).toHaveLength(2);
    expect(positions[0].principalDue).toBe(0.25);
    expect(positions[0].interestDue).toBeCloseTo(0.02);
    expect(positions[1].principalDue).toBe(0.75);
    expect(positions[1].interestDue).toBeCloseTo(0.075);
  });

  it("calculates weighted supplier APR and borrower APR with protocol adjustments", () => {
    expect(calculateWeightedSupplierAprBps(fills)).toBe(950);

    const quote = calculateBorrowerAprQuote(fills, {
      borrowAsset: "BTC",
      minimumAprBps: 500,
      maximumAprBps: 2500,
      protocolSpreadBps: 100,
      durationPremiumBps: 25,
      collateralRiskPremiumBps: 75,
    });

    expect(quote.weightedSupplierAprBps).toBe(950);
    expect(quote.borrowerAprBps).toBe(1150);
  });

  it("calculates the default 1% DCR platform fee and 70/30 split", () => {
    const fee = calculatePlatformFeeBreakdown(100);

    expect(fee.collateralAsset).toBe("DCR");
    expect(fee.totalFeeAmount).toBe(1);
    expect(fee.platformAmount).toBeCloseTo(0.7);
    expect(fee.arbiterReserveAmount).toBeCloseTo(0.3);
  });

  it("creates a privacy-safe evidence summary without private participant metadata", () => {
    const bundle: EvidenceBundle = {
      id: "evidence-1",
      loanId: "loan-1",
      decisionId: "decision-1",
      policyVersion: "policy-v0",
      createdAt: "2026-06-09T03:00:00.000Z",
      collateralAsset: "DCR",
      collateralAmount: 100,
      borrowAsset: "BTC",
      borrowAmount: 1,
      oracleSnapshots: [
        {
          source: "demo-oracle",
          observedAt: "2026-06-09T03:00:00.000Z",
          dcrUsdPrice: 20,
          borrowAssetUsdPrice: 100_000,
          healthy: true,
        },
      ],
      ltvBps: 6000,
      warningThresholdBps: 6500,
      liquidationThresholdBps: 7500,
      graceWindowOpen: false,
      arbiterWindowOpen: false,
      watcherConfirmations: 6,
      transactionTemplateIds: ["template-1"],
      blockers: ["No real broadcast path is implemented."],
      warnings: ["Demo evidence only."],
      recommendedAction: "none",
      status: "ready_for_review",
    };

    expect(createEvidencePublicSummary(bundle)).toEqual({
      evidenceId: "evidence-1",
      loanId: "loan-1",
      decisionId: "decision-1",
      policyVersion: "policy-v0",
      createdAt: "2026-06-09T03:00:00.000Z",
      borrowAsset: "BTC",
      status: "ready_for_review",
      recommendedAction: "none",
      ltvBps: 6000,
      warningCount: 1,
      blockerCount: 1,
      oracleSnapshotCount: 1,
    });
  });

  it("keeps automatic fallback liquidation blocked in the placeholder state", () => {
    const state = createInitialLiquidationState({
      loanId: "loan-1",
      currentLtvBps: 8000,
      policy: {
        policyVersion: "policy-v0",
        warningLtvBps: 6500,
        liquidationLtvBps: 7500,
        arbiterWindowMinutes: 60,
        automaticFallbackEnabled: false,
      },
    });

    expect(state.phase).toBe("arbiter_intervention");
    expect(state.arbiterRequired).toBe(true);
    expect(state.automaticFallbackAllowed).toBe(false);
    expect(state.blockers).toHaveLength(1);
  });
});
