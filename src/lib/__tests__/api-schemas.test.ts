import { describe, expect, it } from "vitest";
import {
  formatSchemaError,
  loanActionSchema,
  loanInputSchema,
  signingSessionCreateRequestSchema,
  signingSubmissionRequestSchema,
  transactionReviewRequestSchema,
} from "../api-schemas";

const unsignedTransaction = {
  id: "unsigned_loan_1_collateral_release",
  network: "simnet",
  purpose: "collateral_release",
  loanId: "loan_1",
  fromAddress: "SsimnetEscrow",
  toAddress: "SsimnetBorrower",
  amountDcr: 10,
  estimatedFeeDcr: 0.001,
  requiredSignatures: 2,
  totalSigners: 3,
  rawTransactionHex: "01000000unsigned",
  warnings: [],
};

describe("API request schemas", () => {
  it("coerces valid loan inputs and defaults to USDC", () => {
    const parsed = loanInputSchema.parse({
      collateralDcr: "100",
      borrowAmount: "350",
    });

    expect(parsed).toEqual({
      collateralDcr: 100,
      borrowAmount: 350,
      borrowAsset: "USDC",
    });
  });

  it("rejects invalid loan inputs with a useful field message", () => {
    const parsed = loanInputSchema.safeParse({ collateralDcr: -1, borrowAmount: 0, borrowAsset: "DOGE" });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(formatSchemaError(parsed.error)).toMatch(/collateralDcr|borrowAmount|borrowAsset/);
    }
  });

  it("accepts known loan actions and rejects unknown actions", () => {
    expect(loanActionSchema.safeParse({ loanId: "loan_123", action: "simulate_repayment" }).success).toBe(true);
    expect(loanActionSchema.safeParse({ loanId: "loan_123", action: "steal_collateral" }).success).toBe(false);
  });

  it("accepts valid transaction review requests with default approval state", () => {
    const parsed = transactionReviewRequestSchema.parse({
      loanId: "loan_123",
      purpose: "collateral_release",
    });

    expect(parsed).toEqual({
      loanId: "loan_123",
      purpose: "collateral_release",
      network: "demo",
      approvals: {
        borrower: false,
        lender: false,
        arbiter: false,
        operator: false,
      },
    });
  });

  it("rejects invalid transaction review purpose and missing loan ID", () => {
    expect(transactionReviewRequestSchema.safeParse({ loanId: "loan_123", purpose: "mint_money" }).success).toBe(false);
    expect(transactionReviewRequestSchema.safeParse({ loanId: "", purpose: "loan_payout" }).success).toBe(false);
  });

  it("rejects non-boolean transaction review approvals", () => {
    expect(
      transactionReviewRequestSchema.safeParse({
        loanId: "loan_123",
        purpose: "loan_payout",
        approvals: { lender: "false", operator: true },
      }).success,
    ).toBe(false);
  });

  it("accepts signing session creation payloads", () => {
    const parsed = signingSessionCreateRequestSchema.safeParse({
      review: {
        id: "review_1",
        loanId: "loan_1",
        purpose: "collateral_release",
        status: "ready_for_signing",
        network: "simnet",
        summary: "Ready.",
        unsignedTransaction,
        requiredApprovals: ["Borrower", "Lender", "Operator"],
        blockers: [],
        createdAt: "2026-06-07T00:00:00.000Z",
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts external signature submission payloads and rejects unknown roles", () => {
    expect(
      signingSubmissionRequestSchema.safeParse({
        sessionId: "signing_review_1",
        role: "borrower",
        signedTransactionHex: "01000000signed",
      }).success,
    ).toBe(true);

    expect(
      signingSubmissionRequestSchema.safeParse({
        sessionId: "signing_review_1",
        role: "operator",
        signedTransactionHex: "01000000signed",
      }).success,
    ).toBe(false);
  });
});
