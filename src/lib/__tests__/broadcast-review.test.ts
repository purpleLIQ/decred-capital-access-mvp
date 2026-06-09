import { describe, expect, it } from "vitest";
import { createBroadcastReview, isBroadcastReviewReady } from "../broadcast-review";
import { addExternalSignatureSubmission, createSigningSession, type SigningSession } from "../signing-collection";
import type { TransactionReview } from "../adapters/decred-types";

const readyReview: TransactionReview = {
  id: "review_release_broadcast",
  loanId: "loan_broadcast_1",
  purpose: "collateral_release",
  status: "ready_for_signing",
  network: "simnet",
  summary: "Ready for external signing collection.",
  unsignedTransaction: {
    id: "unsigned_loan_broadcast_1_collateral_release",
    network: "simnet",
    purpose: "collateral_release",
    loanId: "loan_broadcast_1",
    fromAddress: "SsimnetEscrow",
    toAddress: "SsimnetBorrower",
    amountDcr: 9.99,
    estimatedFeeDcr: 0.01,
    requiredSignatures: 2,
    totalSigners: 3,
    rawTransactionHex: "01000000unsignedbroadcast",
    warnings: [],
  },
  requiredApprovals: ["borrower", "lender", "operator"],
  blockers: [],
  createdAt: "2026-06-09T00:00:00.000Z",
};

function readySigningSession(): SigningSession {
  const session = createSigningSession(readyReview, "2026-06-09T01:00:00.000Z");
  const borrower = addExternalSignatureSubmission(session, {
    role: "borrower",
    signedTransactionHex: "01000000signedborrowerbroadcast",
    submittedAt: "2026-06-09T01:05:00.000Z",
  });
  const lender = addExternalSignatureSubmission(borrower.session, {
    role: "lender",
    signedTransactionHex: "01000000signedlenderbroadcast",
    submittedAt: "2026-06-09T01:10:00.000Z",
  });

  return lender.session;
}

describe("broadcast review gate", () => {
  it("creates a manual review gate for a fully collected simnet signing session", () => {
    const review = createBroadcastReview({
      session: readySigningSession(),
      now: "2026-06-09T02:00:00.000Z",
    });

    expect(review.status).toBe("manual_review");
    expect(review.canBroadcast).toBe(false);
    expect(review.requiresOperatorApproval).toBe(true);
    expect(review.blockers).toEqual([]);
    expect(review.signatureResults).toHaveLength(2);
    expect(isBroadcastReviewReady(review)).toBe(true);
  });

  it("blocks sessions that have not collected all required signatures", () => {
    const session = createSigningSession(readyReview);
    const borrower = addExternalSignatureSubmission(session, {
      role: "borrower",
      signedTransactionHex: "01000000signedborrowerbroadcast",
      submittedAt: "2026-06-09T01:05:00.000Z",
    });
    const review = createBroadcastReview({ session: borrower.session });

    expect(review.status).toBe("blocked");
    expect(review.canBroadcast).toBe(false);
    expect(review.blockers).toContain("Signing session is not ready for broadcast review.");
    expect(review.blockers).toContain("Missing verified external signature from lender.");
    expect(isBroadcastReviewReady(review)).toBe(false);
  });

  it("blocks fixture submissions that do not pass signature verification", () => {
    const session = createSigningSession(readyReview);
    const borrower = addExternalSignatureSubmission(session, {
      role: "borrower",
      signedTransactionHex: "01000000notfixtureborrower",
      submittedAt: "2026-06-09T01:05:00.000Z",
    });
    const lender = addExternalSignatureSubmission(borrower.session, {
      role: "lender",
      signedTransactionHex: "01000000notfixturelender",
      submittedAt: "2026-06-09T01:10:00.000Z",
    });
    const review = createBroadcastReview({ session: lender.session });

    expect(review.status).toBe("blocked");
    expect(review.blockers).toContain("Fixture signed transaction hex must use the fixture signed prefix.");
    expect(review.blockers).toContain("Missing verified external signature from borrower.");
    expect(review.blockers).toContain("Missing verified external signature from lender.");
  });

  it("never broadcasts from the review gate", () => {
    const review = createBroadcastReview({ session: readySigningSession() });

    expect(review.canBroadcast).toBe(false);
    expect(review.warnings).toContain("Broadcast review is a gate only; it does not broadcast transactions.");
  });
});
