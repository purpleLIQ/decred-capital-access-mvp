import { beforeEach, describe, expect, it } from "vitest";
import type { TransactionReview } from "../adapters/decred-types";
import {
  handleAddSigningSubmission,
  handleCreateSigningSession,
  handleListSigningSessions,
} from "../signing-session-api-handlers";
import { resetSigningSessionsForTests } from "../signing-session-store";

const readyReview: TransactionReview = {
  id: "review_route_1",
  loanId: "loan_route_1",
  purpose: "collateral_release",
  status: "ready_for_signing",
  network: "simnet",
  summary: "Ready for external signing.",
  unsignedTransaction: {
    id: "unsigned_loan_route_1_collateral_release",
    network: "simnet",
    purpose: "collateral_release",
    loanId: "loan_route_1",
    fromAddress: "SsimnetEscrow",
    toAddress: "SsimnetBorrower",
    amountDcr: 10,
    estimatedFeeDcr: 0.001,
    requiredSignatures: 2,
    totalSigners: 3,
    rawTransactionHex: "01000000unsigned",
    warnings: [],
  },
  requiredApprovals: ["Borrower", "Lender", "Operator"],
  blockers: [],
  createdAt: "2026-06-08T00:00:00.000Z",
};

describe("signing session API handlers", () => {
  beforeEach(() => resetSigningSessionsForTests());

  it("lists sessions", () => {
    const response = handleListSigningSessions();

    expect(response.status).toBe(200);
    expect(response.body.sessions).toEqual([]);
  });

  it("creates a signing session from a valid review payload", () => {
    const response = handleCreateSigningSession({ review: readyReview });

    expect(response.status).toBe(200);
    expect(response.body.canSubmitSignatures).toBe(true);
    expect(response.body.session).toMatchObject({
      reviewId: "review_route_1",
      status: "collecting",
      requiredRoles: ["borrower", "lender"],
    });
  });

  it("returns 400 for invalid create payloads", () => {
    const response = handleCreateSigningSession({ review: { id: "missing-fields" } });

    expect(response.status).toBe(400);
    expect(response.body.error).toBeTruthy();
  });

  it("returns 404 for unknown signing sessions", () => {
    const response = handleAddSigningSubmission({
      sessionId: "missing",
      role: "borrower",
      signedTransactionHex: "01000000signedborrower",
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Signing session not found.");
  });

  it("adds external submissions and reports readiness", () => {
    const created = handleCreateSigningSession({ review: readyReview });
    const sessionId = (created.body.session as { id: string }).id;

    const borrower = handleAddSigningSubmission({
      sessionId,
      role: "borrower",
      signedTransactionHex: "01000000signedborrower",
    });

    expect(borrower.status).toBe(200);
    expect(borrower.body.accepted).toBe(true);
    expect(borrower.body.session).toMatchObject({ status: "collecting" });

    const lender = handleAddSigningSubmission({
      sessionId,
      role: "lender",
      signedTransactionHex: "01000000signedborrowerlender",
    });

    expect(lender.status).toBe(200);
    expect(lender.body.accepted).toBe(true);
    expect(lender.body.session).toMatchObject({ status: "ready_for_broadcast_review" });
  });

  it("rejects unsafe or invalid submissions", () => {
    const created = handleCreateSigningSession({ review: readyReview });
    const sessionId = (created.body.session as { id: string }).id;

    const invalidRole = handleAddSigningSubmission({
      sessionId,
      role: "operator",
      signedTransactionHex: "01000000signed",
    });

    expect(invalidRole.status).toBe(400);

    const unsignedResubmission = handleAddSigningSubmission({
      sessionId,
      role: "borrower",
      signedTransactionHex: "01000000unsigned",
    });

    expect(unsignedResubmission.status).toBe(400);
    expect(unsignedResubmission.body.blockers).toContain("Submitted transaction hex must differ from the unsigned raw transaction hex.");
  });
});
