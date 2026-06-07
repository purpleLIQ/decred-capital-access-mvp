import { describe, expect, it } from "vitest";
import { DemoDecredAdapter } from "../adapters/decred-adapter";
import { buildApprovalState, canMoveToSigning } from "../transaction-review";
import { demoLoans } from "../fixtures";

describe("transaction review model", () => {
  it("builds blocked demo reviews before signing", () => {
    const adapter = new DemoDecredAdapter();
    const review = adapter.createTransactionReview(demoLoans[0], "collateral_release");
    const approvals = buildApprovalState(review.requiredApprovals);

    expect(review.status).toBe("blocked");
    expect(review.unsignedTransaction).toBeNull();
    expect(approvals.every((approval) => !approval.approved)).toBe(true);
    expect(canMoveToSigning(review, approvals)).toBe(false);
  });

  it("requires every approval and zero blockers before signing", () => {
    const adapter = new DemoDecredAdapter();
    const review = {
      ...adapter.createTransactionReview(demoLoans[0], "liquidation"),
      status: "ready_for_signing" as const,
      blockers: [],
    };
    const partialApprovals = buildApprovalState(review.requiredApprovals).map((approval, index) => ({
      ...approval,
      approved: index === 0,
    }));
    const fullApprovals = partialApprovals.map((approval) => ({ ...approval, approved: true }));

    expect(canMoveToSigning(review, partialApprovals)).toBe(false);
    expect(canMoveToSigning(review, fullApprovals)).toBe(true);
  });
});
