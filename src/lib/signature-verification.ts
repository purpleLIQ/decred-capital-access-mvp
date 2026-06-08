import type { UnsignedTransactionPreview } from "./adapters/decred-types";
import type { ExternalSignatureSubmission, SigningRole } from "./signing-collection";

export interface SignatureVerificationInput {
  unsignedTransaction: UnsignedTransactionPreview;
  submission: ExternalSignatureSubmission;
  requiredRoles: SigningRole[];
}

export interface SignatureVerificationResult {
  ok: boolean;
  role: SigningRole;
  network: UnsignedTransactionPreview["network"];
  blockers: string[];
  warnings: string[];
}

export interface SignatureVerifier {
  verify(input: SignatureVerificationInput): SignatureVerificationResult;
}

export const fixtureSignatureVerifier: SignatureVerifier = {
  verify(input) {
    return verifyFixtureSignatureSubmission(input);
  },
};

export function verifyFixtureSignatureSubmission(input: SignatureVerificationInput): SignatureVerificationResult {
  const blockers: string[] = [];
  const warnings = [
    "Fixture verifier only. Replace with Decred transaction verification before simnet broadcast review.",
  ];

  if (input.unsignedTransaction.network !== "simnet") blockers.push("Fixture verifier only accepts simnet transactions.");
  if (!input.requiredRoles.includes(input.submission.role)) blockers.push(`${input.submission.role} is not required for this session.`);
  if (!input.submission.signedTransactionHex?.trim()) blockers.push("Signed transaction hex is required.");
  if (input.submission.signedTransactionHex === input.unsignedTransaction.rawTransactionHex) {
    blockers.push("Signed transaction hex must differ from unsigned transaction hex.");
  }
  if (!input.submission.signedTransactionHex.startsWith("01000000signed")) {
    blockers.push("Fixture signed transaction hex must use the fixture signed prefix.");
  }
  if (input.unsignedTransaction.requiredSignatures !== 2 || input.unsignedTransaction.totalSigners !== 3) {
    blockers.push("Unsigned transaction must preserve 2-of-3 signing metadata.");
  }

  return {
    ok: blockers.length === 0,
    role: input.submission.role,
    network: input.unsignedTransaction.network,
    blockers: [...new Set(blockers)],
    warnings,
  };
}
