import { beforeEach, describe, expect, it } from "vitest";
import type { TransactionReview } from "../adapters/decred-types";
import { handleCreateBroadcastReview, handleListBroadcastReviews } from "../broadcast-review-api-handlers";
import { resetBroadcastReviewsForTests } from "../broadcast-review-store";
import { handleAddSigningSubmission, handleCreateSigningSession } from "../signing-session-api-handlers";
import { resetSigningSessionsForTests } from "../signing-session-store";

const readyReview: TransactionReview = {
  id: "review_broadcast_api_1",
  loanId: "loan_broadcast_api_1",
  purpose: "collateral_release",
  status: "ready_for_signing",
  network: "simnet",
  summary: "Ready for external signing.",
  unsignedTransaction: {
    id: "unsigned_loan_broadcast_api_1_collateral_release",
    network: "simnet",
    purpose: "collateral_release",
    loanId: "loan_broadcast_api_1",
    fromAddress: "SsimnetEscrow",
    toAddress: "SsimnetBorrower",
    amountDcr: 10,
    estimatedFeeDcr: 0.001,
    requiredSignatures: 2,
    totalSigners: 3,
    rawTransactionHex: "01000000unsignedbroadcastapi",
    warnings: [],
  },
  requiredApprovals: ["Borrower", "Lender", "Operator"],
  blockers: [],
  createdAt: "2026-06-09T00:00:00.000Z",
};

function createReadySigningSession() {
  const created = handleCreateSigningSession({ review: readyReview });
  const sessionId = (created.body.session as { id: string }).id;

  handleAddSigningSubmission({
    sessionId,
    role: "borrower",
    signedTransactionHex: "01000000signedborrowerbroadcastapi",
  });

  handleAddSigningSubmission({
    sessionId,
    role: "lender",
    signedTransactionHex: "01000000signedlenderbroadcastapi",
  });

  return sessionId;
}

describe("broadcast review API handlers", () => {
  beforeEach(() => {
    resetSigningSessionsForTests();
    resetBroadcastReviewsForTests();
  });

  it("lists broadcast reviews", () => {
    const response = handleListBroadcastReviews();

    expect(response.status).toBe(200);
    expect(response.body.reviews).toEqual([]);
  });

  it("creates a manual review for a completed signing session", () => {
    const sessionId = createReadySigningSession();

    const response = handleCreateBroadcastReview({ sessionId });

    expect(response.status).toBe(200);
    expect(response.body.canBroadcast).toBe(false);
    expect(response.body.review).toMatchObject({
      sessionId,
      status: "manual_review",
      canBroadcast: false,
      requiresOperatorApproval: true,
      blockers: [],
    });
  });

  it("stores created broadcast reviews", () => {
    const sessionId = createReadySigningSession();
    handleCreateBroadcastReview({ sessionId });

    const response = handleListBroadcastReviews();

    expect(response.status).toBe(200);
    expect(response.body.reviews).toHaveLength(1);
    expect(response.body.reviews[0]).toMatchObject({ sessionId, status: "manual_review", canBroadcast: false });
  });

  it("returns 400 for blocked broadcast reviews", () => {
    const created = handleCreateSigningSession({ review: readyReview });
    const sessionId = (created.body.session as { id: string }).id;

    const response = handleCreateBroadcastReview({ sessionId });

    expect(response.status).toBe(400);
    expect(response.body.review).toMatchObject({
      sessionId,
      status: "blocked",
      canBroadcast: false,
    });
  });

  it("returns 400 for invalid payloads", () => {
    const response = handleCreateBroadcastReview({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("sessionId is required.");
  });

  it("returns 404 for missing signing sessions", () => {
    const response = handleCreateBroadcastReview({ sessionId: "missing" });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Signing session not found.");
  });
});
