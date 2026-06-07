import type { TransactionReview, UnsignedTransactionPreview } from "./adapters/decred-types";

export type SigningRole = "borrower" | "lender" | "arbiter";
export type SigningSessionStatus = "blocked" | "collecting" | "ready_for_broadcast_review";

export interface ExternalSignatureSubmission {
  role: SigningRole;
  signedTransactionHex: string;
  signerAddress?: string;
  note?: string;
  submittedAt: string;
}

export interface SigningSubmissionResult {
  session: SigningSession;
  accepted: boolean;
  blockers: string[];
}

export interface SigningSession {
  id: string;
  reviewId: string;
  loanId: string;
  purpose: TransactionReview["purpose"];
  network: Exclude<TransactionReview["network"], "demo">;
  unsignedTransaction: UnsignedTransactionPreview;
  requiredRoles: SigningRole[];
  submissions: ExternalSignatureSubmission[];
  status: SigningSessionStatus;
  blockers: string[];
  warnings: string[];
  createdAt: string;
}

const roleMap: Record<string, SigningRole | null> = {
  Borrower: "borrower",
  Lender: "lender",
  Arbiter: "arbiter",
  Operator: null,
};

const sensitiveFieldNames = [
  "privateKey",
  "private_key",
  "wif",
  "seed",
  "mnemonic",
  "walletPassphrase",
  "wallet_passphrase",
  "passphrase",
  "xprv",
];

export function createSigningSession(review: TransactionReview, now = new Date().toISOString()): SigningSession {
  const requiredRoles = requiredSigningRoles(review);
  const blockers = signingSessionBlockers(review, requiredRoles);

  return {
    id: `signing_${review.id}`,
    reviewId: review.id,
    loanId: review.loanId,
    purpose: review.purpose,
    network: review.network === "demo" ? "simnet" : review.network,
    unsignedTransaction: review.unsignedTransaction ?? emptyUnsignedTransaction(review),
    requiredRoles,
    submissions: [],
    status: blockers.length > 0 ? "blocked" : "collecting",
    blockers,
    warnings: [
      "Signing must happen outside the app-owned server process.",
      "Do not submit private keys, seed phrases, wallet passphrases, or wallet files.",
      "Broadcast remains a separate future review step.",
    ],
    createdAt: now,
  };
}

export function addExternalSignatureSubmission(
  session: SigningSession,
  submission: ExternalSignatureSubmission,
): SigningSubmissionResult {
  const blockers = validateSubmission(session, submission);

  if (blockers.length > 0) {
    return { session, accepted: false, blockers };
  }

  const nextSubmissions = [
    ...session.submissions.filter((existing) => existing.role !== submission.role),
    submission,
  ];
  const nextSession = refreshSigningSession({ ...session, submissions: nextSubmissions });

  return { session: nextSession, accepted: true, blockers: [] };
}

export function canMoveToBroadcastReview(session: SigningSession): boolean {
  return session.status === "ready_for_broadcast_review" && session.blockers.length === 0 && hasRequiredSignatures(session);
}

export function refreshSigningSession(session: SigningSession): SigningSession {
  const blockers = [...session.blockers.filter((blocker) => !blocker.startsWith("Missing external signature from "))];

  for (const role of session.requiredRoles) {
    if (!session.submissions.some((submission) => submission.role === role)) {
      blockers.push(`Missing external signature from ${role}.`);
    }
  }

  return {
    ...session,
    blockers,
    status: blockers.length > 0 ? "collecting" : "ready_for_broadcast_review",
  };
}

export function containsSensitiveSigningMaterial(value: unknown): boolean {
  return findSensitiveSigningMaterial(value).length > 0;
}

export function findSensitiveSigningMaterial(value: unknown, path = "submission"): string[] {
  if (!value || typeof value !== "object") return [];

  return Object.entries(value as Record<string, unknown>).flatMap(([key, nestedValue]) => {
    const nextPath = `${path}.${key}`;
    const keyMatches = sensitiveFieldNames.some((fieldName) => fieldName.toLowerCase() === key.toLowerCase());
    const nestedMatches = typeof nestedValue === "object" && nestedValue !== null ? findSensitiveSigningMaterial(nestedValue, nextPath) : [];
    return keyMatches ? [nextPath, ...nestedMatches] : nestedMatches;
  });
}

function requiredSigningRoles(review: TransactionReview): SigningRole[] {
  const roles = review.requiredApprovals.flatMap((approvalRole) => {
    const role = roleMap[approvalRole];
    return role ? [role] : [];
  });

  return [...new Set(roles)];
}

function signingSessionBlockers(review: TransactionReview, requiredRoles: SigningRole[]): string[] {
  const blockers = [...review.blockers];

  if (review.network === "demo") blockers.push("Demo reviews cannot enter signing collection.");
  if (review.network === "mainnet") blockers.push("Mainnet signing collection is not enabled.");
  if (review.status !== "ready_for_signing") blockers.push("Review status must be ready_for_signing before collecting signatures.");
  if (!review.unsignedTransaction?.rawTransactionHex) blockers.push("Unsigned raw transaction hex is required before collecting signatures.");
  if (requiredRoles.length < 2) blockers.push("At least two non-operator signing roles are required.");

  return [...new Set(blockers)];
}

function validateSubmission(session: SigningSession, submission: ExternalSignatureSubmission): string[] {
  const blockers = [...session.blockers.filter((blocker) => !blocker.startsWith("Missing external signature from "))];
  const sensitivePaths = findSensitiveSigningMaterial(submission);

  if (session.status === "blocked") blockers.push("Signing session is blocked.");
  if (!session.requiredRoles.includes(submission.role)) blockers.push(`${submission.role} is not required for this signing session.`);
  if (!submission.signedTransactionHex?.trim()) blockers.push("Externally signed transaction hex is required.");
  if (submission.signedTransactionHex === session.unsignedTransaction.rawTransactionHex) {
    blockers.push("Submitted transaction hex must differ from the unsigned raw transaction hex.");
  }
  if (sensitivePaths.length > 0) blockers.push(`Submission contains forbidden sensitive fields: ${sensitivePaths.join(", ")}.`);

  return [...new Set(blockers)];
}

function hasRequiredSignatures(session: SigningSession): boolean {
  return session.requiredRoles.every((role) => session.submissions.some((submission) => submission.role === role));
}

function emptyUnsignedTransaction(review: TransactionReview): UnsignedTransactionPreview {
  return {
    id: `missing_unsigned_${review.id}`,
    network: "simnet",
    purpose: review.purpose,
    loanId: review.loanId,
    fromAddress: "",
    toAddress: "",
    amountDcr: 0,
    estimatedFeeDcr: 0,
    requiredSignatures: 2,
    totalSigners: 3,
    rawTransactionHex: null,
    warnings: ["Missing unsigned transaction preview."],
  };
}
