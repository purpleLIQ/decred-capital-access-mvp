import { describe, expect, it } from "vitest";
import type { TransactionReview } from "../adapters/decred-types";
import {
  addExternalSignatureSubmission,
  canMoveToBroadcastReview,
  containsSensitiveSigningMaterial,
  createSigningSession,
  findSensitiveSigningMaterial,
} from "../signing-collection";

const readyReview: TransactionReview = {
  id: "review_release_1",
  loanId: "loan_1",
  purpose: "collateral_release",
  status: "ready_for_signing",
  network: "simnet",
  summary: "Ready for external signing collection.",
  unsignedTransaction: {
    id: "unsigned_loan_1_collateral_release",
    network: "simnet",
    purpose: "collateral_release",
    loanId: "loan_1",
    fromAddress: "SsimnetEscrow",
    toAddress: "SsimnetBorrower",
    amountDcr: 9.99,
    estimatedFeeDcr: 0.01,
    requiredSignatures: 2,
    totalSigners: 3,
    rawTransactionHex: "01000000unsigned",
    warnings: [],
  },
  requiredApprovals: ["Borrower", "Lender", "Operator"],
  blockers: [],
  createdAt: "2026-06-07T00:00:00.000Z",
};

describe("non-custodial signing collection", () => {
  it("creates a collecting session from a ready simnet review", () => {
    const session = createSigningSession(readyReview, "2026-06-07T01:00:00.000Z");

    expect(session.status).toBe("collecting");
    expect(session.network).toBe("simnet");
    expect(session.requiredRoles).toEqual(["borrower", "lender"]);
    expect(session.blockers).toEqual([]);
    expect(session.warnings).toContain("Signing must happen outside the app-owned server process.");
    expect(canMoveToBroadcastReview(session)).toBe(false);
  });

  it("accepts lowercase review approval roles from app envelopes", () => {
    const session = createSigningSession({
      ...readyReview,
      requiredApprovals: ["borrower", "lender", "operator"],
    });

    expect(session.status).toBe("collecting");
    expect(session.requiredRoles).toEqual(["borrower", "lender"]);
    expect(session.blockers).toEqual([]);
  });

  it("blocks demo and non-ready reviews", () => {
    const session = createSigningSession({
      ...readyReview,
      status: "blocked",
      network: "demo",
      unsignedTransaction: null,
      blockers: ["Unsigned transaction builder is not implemented."],
    });

    expect(session.status).toBe("blocked");
    expect(session.blockers).toContain("Demo reviews cannot enter signing collection.");
    expect(session.blockers).toContain("Review status must be ready_for_signing before collecting signatures.");
    expect(session.blockers).toContain("Unsigned raw transaction hex is required before collecting signatures.");
    expect(session.blockers).toContain("Unsigned transaction builder is not implemented.");
  });

  it("rejects submissions containing private key material", () => {
    const session = createSigningSession(readyReview);
    const result = addExternalSignatureSubmission(session, {
      role: "borrower",
      signedTransactionHex: "01000000signedborrower",
      submittedAt: "2026-06-07T02:00:00.000Z",
      // @ts-expect-error Verifies runtime rejection of unsafe extra fields.
      privateKey: "do-not-store-this",
    });

    expect(result.accepted).toBe(false);
    expect(result.blockers.join(" ")).toContain("forbidden sensitive fields");
    expect(result.session.submissions).toHaveLength(0);
  });

  it("collects required external signatures before broadcast review", () => {
    const session = createSigningSession(readyReview);
    const borrower = addExternalSignatureSubmission(session, {
      role: "borrower",
      signedTransactionHex: "01000000signedborrower",
      submittedAt: "2026-06-07T02:00:00.000Z",
    });

    expect(borrower.accepted).toBe(true);
    expect(borrower.session.status).toBe("collecting");
    expect(borrower.session.blockers).toContain("Missing external signature from lender.");
    expect(canMoveToBroadcastReview(borrower.session)).toBe(false);

    const lender = addExternalSignatureSubmission(borrower.session, {
      role: "lender",
      signedTransactionHex: "01000000signedborrowerlender",
      submittedAt: "2026-06-07T02:05:00.000Z",
    });

    expect(lender.accepted).toBe(true);
    expect(lender.session.status).toBe("ready_for_broadcast_review");
    expect(lender.session.blockers).toEqual([]);
    expect(canMoveToBroadcastReview(lender.session)).toBe(true);
  });

  it("rejects unsigned hex pasted back as a signature", () => {
    const session = createSigningSession(readyReview);
    const result = addExternalSignatureSubmission(session, {
      role: "borrower",
      signedTransactionHex: "01000000unsigned",
      submittedAt: "2026-06-07T02:00:00.000Z",
    });

    expect(result.accepted).toBe(false);
    expect(result.blockers).toContain("Submitted transaction hex must differ from the unsigned raw transaction hex.");
  });

  it("detects sensitive nested fields", () => {
    const unsafePayload = {
      metadata: {
        walletPassphrase: "nope",
        nested: { mnemonic: "also nope" },
      },
    };

    expect(containsSensitiveSigningMaterial(unsafePayload)).toBe(true);
    expect(findSensitiveSigningMaterial(unsafePayload)).toEqual([
      "submission.metadata.walletPassphrase",
      "submission.metadata.nested.mnemonic",
    ]);
  });
});
