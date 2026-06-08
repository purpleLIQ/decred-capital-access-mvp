import { describe, expect, it } from "vitest";
import type { UnsignedTransactionPreview } from "../adapters/decred-types";
import type { ExternalSignatureSubmission } from "../signing-collection";
import { verifyFixtureSignatureSubmission } from "../signature-verification";

const unsignedTransaction: UnsignedTransactionPreview = {
  id: "unsigned_fixture_release",
  network: "simnet",
  purpose: "collateral_release",
  loanId: "loan_fixture",
  fromAddress: "SsFixtureEscrow",
  toAddress: "SsFixtureBorrowerRefund",
  amountDcr: 9.999,
  estimatedFeeDcr: 0.001,
  requiredSignatures: 2,
  totalSigners: 3,
  rawTransactionHex: "01000000unsignedfixture",
  warnings: [],
};

const borrowerSubmission: ExternalSignatureSubmission = {
  role: "borrower",
  signedTransactionHex: "01000000signedborrowerfixture",
  submittedAt: "2026-06-08T00:00:00.000Z",
};

describe("fixture signature verifier", () => {
  it("accepts fixture signed hex for a required simnet role", () => {
    const result = verifyFixtureSignatureSubmission({
      unsignedTransaction,
      submission: borrowerSubmission,
      requiredRoles: ["borrower", "lender"],
    });

    expect(result.ok).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.network).toBe("simnet");
  });

  it("rejects unsigned hex submitted as signed hex", () => {
    const result = verifyFixtureSignatureSubmission({
      unsignedTransaction,
      submission: { ...borrowerSubmission, signedTransactionHex: unsignedTransaction.rawTransactionHex ?? "" },
      requiredRoles: ["borrower", "lender"],
    });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContain("Signed transaction hex must differ from unsigned transaction hex.");
  });

  it("rejects roles not required for the session", () => {
    const result = verifyFixtureSignatureSubmission({
      unsignedTransaction,
      submission: { ...borrowerSubmission, role: "arbiter" },
      requiredRoles: ["borrower", "lender"],
    });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContain("arbiter is not required for this session.");
  });

  it("rejects non-simnet transactions", () => {
    const result = verifyFixtureSignatureSubmission({
      unsignedTransaction: { ...unsignedTransaction, network: "mainnet" },
      submission: borrowerSubmission,
      requiredRoles: ["borrower", "lender"],
    });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContain("Fixture verifier only accepts simnet transactions.");
  });

  it("rejects transactions that do not preserve 2-of-3 metadata", () => {
    const result = verifyFixtureSignatureSubmission({
      unsignedTransaction: { ...unsignedTransaction, requiredSignatures: 1 },
      submission: borrowerSubmission,
      requiredRoles: ["borrower", "lender"],
    });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContain("Unsigned transaction must preserve 2-of-3 signing metadata.");
  });
});
