import { beforeEach, describe, expect, it } from "vitest";
import type { TransactionReview } from "../adapters/decred-types";
import {
  addSigningSubmission,
  createAndStoreSigningSession,
  getSigningSession,
  listSigningSessions,
  resetSigningSessionsForTests,
} from "../signing-session-store";

const readyReview: TransactionReview = {
  id: "review_release_store",
  loanId: "loan_store",
  purpose: "collateral_release",
  status: "ready_for_signing",
  network: "simnet",
  summary: "Ready for signing collection.",
  unsignedTransaction: {
    id: "unsigned_loan_store_collateral_release",
    network: "simnet",
    purpose: "collateral_release",
    loanId: "loan_store",
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
  createdAt: "2026-06-07T00:00:00.000Z",
};

describe("demo signing session store", () => {
  beforeEach(() => resetSigningSessionsForTests());

  it("stores and lists signing sessions", () => {
    const session = createAndStoreSigningSession(readyReview);

    expect(getSigningSession(session.id)?.id).toBe(session.id);
    expect(listSigningSessions()).toHaveLength(1);
    expect(listSigningSessions()[0].status).toBe("collecting");
  });

  it("adds accepted external submissions and updates readiness", () => {
    const session = createAndStoreSigningSession(readyReview);

    const borrower = addSigningSubmission(session.id, {
      role: "borrower",
      signedTransactionHex: "01000000signedborrower",
      submittedAt: "2026-06-07T01:00:00.000Z",
    });

    expect(borrower?.accepted).toBe(true);
    expect(getSigningSession(session.id)?.status).toBe("collecting");

    const lender = addSigningSubmission(session.id, {
      role: "lender",
      signedTransactionHex: "01000000signedborrowerlender",
      submittedAt: "2026-06-07T01:05:00.000Z",
    });

    expect(lender?.accepted).toBe(true);
    expect(getSigningSession(session.id)?.status).toBe("ready_for_broadcast_review");
  });

  it("does not store rejected unsafe submissions", () => {
    const session = createAndStoreSigningSession(readyReview);
    const result = addSigningSubmission(session.id, {
      role: "borrower",
      signedTransactionHex: "01000000signedborrower",
      submittedAt: "2026-06-07T01:00:00.000Z",
      // @ts-expect-error Runtime guard rejects unsafe extra fields.
      mnemonic: "do not store this",
    });

    expect(result?.accepted).toBe(false);
    expect(getSigningSession(session.id)?.submissions).toHaveLength(0);
  });

  it("returns null for unknown sessions", () => {
    expect(getSigningSession("missing")).toBeNull();
    expect(addSigningSubmission("missing", {
      role: "borrower",
      signedTransactionHex: "01000000signedborrower",
      submittedAt: "2026-06-07T01:00:00.000Z",
    })).toBeNull();
  });
});
