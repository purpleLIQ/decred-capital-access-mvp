import { describe, expect, it } from "vitest";
import type { TransactionPurpose, TransactionReview, UnsignedTransactionPreview } from "../adapters/decred-types";
import { demoLoans, demoMarketSnapshot } from "../fixtures";
import { protocolConfig } from "../protocol-config";
import type { Loan, MarketSnapshot } from "../types";
import {
  canMoveToSigning,
  createTransactionReviewEnvelope,
  requiredApprovalsForPurpose,
  type TransactionReviewEnvelope,
} from "../transaction-review";

function loanAtLtv(ltvBps: number): Loan {
  return { ...demoLoans[0], currentLtvBps: ltvBps };
}

function marketOverride(overrides: Partial<MarketSnapshot>): MarketSnapshot {
  return { ...demoMarketSnapshot, ...overrides };
}

function readyReview(overrides: Partial<TransactionReviewEnvelope> = {}): TransactionReviewEnvelope {
  const unsignedTransaction: UnsignedTransactionPreview = {
    id: "unsigned_ready",
    network: "simnet",
    purpose: "collateral_release",
    loanId: "loan_ready",
    fromAddress: "SsEscrow",
    toAddress: "SsBorrowerRefund",
    amountDcr: 100,
    estimatedFeeDcr: 0.001,
    requiredSignatures: 2,
    totalSigners: 3,
    rawTransactionHex: "01000000syntheticunsigned",
    warnings: [],
  };

  const adapterReview: TransactionReview = {
    id: "txreview_ready",
    loanId: "loan_ready",
    purpose: "collateral_release",
    status: "ready_for_signing",
    network: "simnet",
    summary: "Synthetic ready review.",
    unsignedTransaction,
    requiredApprovals: ["Borrower", "Lender", "Operator"],
    blockers: [],
    createdAt: "2026-06-01T00:00:00.000Z",
  };

  return {
    id: "txreview_ready",
    loanId: "loan_ready",
    loanRef: "DCR-READY",
    purpose: "collateral_release",
    purposeLabel: "Collateral release review",
    network: "simnet",
    status: "ready_for_signing",
    summary: "Synthetic ready review.",
    adapterReview,
    unsignedTransaction,
    approvals: { borrower: true, lender: true, arbiter: false, operator: true },
    requiredApprovals: ["borrower", "lender", "operator"],
    blockers: [],
    warnings: [],
    signingBoundary: {
      canSign: false,
      canBroadcast: false,
      storesPrivateKeys: false,
      rawTransactionHexPresent: true,
      privateKeyHandling: "none",
      broadcastHandling: "disabled",
    },
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("transaction review envelope", () => {
  it("keeps demo transaction reviews blocked without raw transaction hex", () => {
    const review = createTransactionReviewEnvelope({
      loan: demoLoans[0],
      purpose: "collateral_release",
      network: "demo",
      approvals: { borrower: true, lender: true, operator: true },
    });

    expect(review.status).toBe("blocked");
    expect(review.unsignedTransaction).toBeNull();
    expect(review.signingBoundary.rawTransactionHexPresent).toBe(false);
    expect(review.blockers).toContain(
      "Demo reviews cannot move to signing because demo mode has no wallet RPC or raw transaction builder.",
    );
    expect(canMoveToSigning(review)).toBe(false);
  });

  it("keeps simnet transaction reviews blocked until RPC and unsigned builders exist", () => {
    const review = createTransactionReviewEnvelope({
      loan: demoLoans[0],
      purpose: "loan_payout",
      network: "simnet",
      approvals: { lender: true, operator: true },
    });

    expect(review.status).toBe("blocked");
    expect(review.network).toBe("simnet");
    expect(review.blockers).toContain(
      "Simnet reviews cannot move to signing until wallet RPC and unsigned transaction construction are implemented.",
    );
    expect(review.signingBoundary.canSign).toBe(false);
    expect(review.signingBoundary.canBroadcast).toBe(false);
  });

  it("does not move to signing with blockers", () => {
    expect(canMoveToSigning(readyReview({ blockers: ["Oracle degraded."] }))).toBe(false);
  });

  it("does not move to signing with partial approvals", () => {
    expect(
      canMoveToSigning(
        readyReview({
          approvals: { borrower: true, lender: false, arbiter: false, operator: true },
        }),
      ),
    ).toBe(false);
  });

  it("moves to signing only when status, blockers, approvals, and unsigned transaction are ready", () => {
    expect(canMoveToSigning(readyReview())).toBe(true);
    expect(canMoveToSigning(readyReview({ status: "draft" }))).toBe(false);
    expect(canMoveToSigning(readyReview({ unsignedTransaction: null }))).toBe(false);
  });

  it("maps transaction purposes to required roles and warnings", () => {
    const expectedRoles: Record<TransactionPurpose, string[]> = {
      collateral_deposit: ["borrower", "operator"],
      loan_payout: ["lender", "operator"],
      collateral_release: ["borrower", "lender", "operator"],
      liquidation: ["lender", "arbiter", "operator"],
    };

    for (const [purpose, roles] of Object.entries(expectedRoles) as Array<[TransactionPurpose, string[]]>) {
      expect(requiredApprovalsForPurpose(purpose)).toEqual(roles);
      const review = createTransactionReviewEnvelope({ loan: demoLoans[0], purpose, network: "demo" });
      expect(review.warnings.length).toBeGreaterThan(0);
    }
  });

  it("keeps liquidation review blocked when policy guardrails fail", () => {
    const review = createTransactionReviewEnvelope({
      loan: loanAtLtv(protocolConfig.hardLiquidationLtvBps),
      purpose: "liquidation",
      network: "simnet",
      market: marketOverride({ sourceCount: 1, stale: true, warnings: [] }),
      dexDepthUsd: 1,
      minutesSinceWarning: 0,
    });

    expect(review.status).toBe("blocked");
    expect(review.liquidationDecision?.action).toBe("queue_review");
    expect(review.blockers).toContain("Oracle must be healthy before automated liquidation can run.");
    expect(review.blockers).toContain("DEX depth is below the configured automated liquidation minimum.");
    expect(review.blockers).toContain("Grace period has not elapsed since warning.");
  });

  it("keeps liquidation execution gated even when policy allows an auto-liquidate decision", () => {
    const review = createTransactionReviewEnvelope({
      loan: loanAtLtv(protocolConfig.hardLiquidationLtvBps),
      purpose: "liquidation",
      network: "simnet",
      market: demoMarketSnapshot,
      dexDepthUsd: protocolConfig.minLiquidationDexDepthUsd,
      minutesSinceWarning: protocolConfig.liquidationGracePeriodMinutes,
      approvals: { lender: true, arbiter: true, operator: true },
    });

    expect(review.liquidationDecision?.action).toBe("auto_liquidate");
    expect(review.liquidationDecision?.automationAllowed).toBe(true);
    expect(review.signingBoundary.canSign).toBe(false);
    expect(review.signingBoundary.canBroadcast).toBe(false);
    expect(canMoveToSigning(review)).toBe(false);
  });
});
