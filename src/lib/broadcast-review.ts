import { canMoveToBroadcastReview, type SigningSession } from "./signing-collection";
import {
  fixtureSignatureVerifier,
  type SignatureVerificationResult,
  type SignatureVerifier,
} from "./signature-verification";

export type BroadcastReviewStatus = "blocked" | "manual_review" | "ready";

export interface BroadcastReviewGate {
  id: string;
  sessionId: string;
  loanId: string;
  purpose: SigningSession["purpose"];
  network: SigningSession["network"];
  status: BroadcastReviewStatus;
  canBroadcast: false;
  requiresOperatorApproval: true;
  blockers: string[];
  warnings: string[];
  signatureResults: SignatureVerificationResult[];
  createdAt: string;
}

export interface CreateBroadcastReviewInput {
  session: SigningSession;
  verifier?: SignatureVerifier;
  now?: string;
}

export function createBroadcastReview(input: CreateBroadcastReviewInput): BroadcastReviewGate {
  const verifier = input.verifier ?? fixtureSignatureVerifier;
  const blockers = new Set<string>();
  const warnings = new Set<string>([
    "Broadcast review is a gate only; it does not broadcast transactions.",
    "Operator approval and real Decred transaction verification are required before any future broadcast path.",
  ]);

  if (!canMoveToBroadcastReview(input.session)) {
    blockers.add("Signing session is not ready for broadcast review.");
  }

  if (input.session.network !== "simnet") {
    blockers.add("Only simnet broadcast review is enabled for this MVP gate.");
  }

  if (!input.session.unsignedTransaction.rawTransactionHex) {
    blockers.add("Unsigned transaction hex is required before broadcast review.");
  }

  const signatureResults = input.session.submissions.map((submission) =>
    verifier.verify({
      unsignedTransaction: input.session.unsignedTransaction,
      submission,
      requiredRoles: input.session.requiredRoles,
    }),
  );

  for (const result of signatureResults) {
    for (const blocker of result.blockers) blockers.add(blocker);
    for (const warning of result.warnings) warnings.add(warning);
  }

  const missingVerificationRoles = input.session.requiredRoles.filter(
    (role) => !signatureResults.some((result) => result.role === role && result.ok),
  );

  for (const role of missingVerificationRoles) {
    blockers.add(`Missing verified external signature from ${role}.`);
  }

  const status: BroadcastReviewStatus = blockers.size > 0 ? "blocked" : "manual_review";

  return {
    id: `broadcast_review_${input.session.id}`,
    sessionId: input.session.id,
    loanId: input.session.loanId,
    purpose: input.session.purpose,
    network: input.session.network,
    status,
    canBroadcast: false,
    requiresOperatorApproval: true,
    blockers: [...blockers],
    warnings: [...warnings],
    signatureResults,
    createdAt: input.now ?? new Date().toISOString(),
  };
}

export function isBroadcastReviewReady(review: BroadcastReviewGate): boolean {
  return review.status === "manual_review" && review.blockers.length === 0 && !review.canBroadcast;
}
