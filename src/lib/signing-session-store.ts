import type { TransactionReview } from "./adapters/decred-types";
import {
  addExternalSignatureSubmission,
  createSigningSession,
  type ExternalSignatureSubmission,
  type SigningSession,
  type SigningSubmissionResult,
} from "./signing-collection";

const sessions = new Map<string, SigningSession>();

export function createAndStoreSigningSession(review: TransactionReview): SigningSession {
  const session = createSigningSession(review);
  sessions.set(session.id, session);
  return session;
}

export function getSigningSession(sessionId: string): SigningSession | null {
  return sessions.get(sessionId) ?? null;
}

export function listSigningSessions(): SigningSession[] {
  return [...sessions.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addSigningSubmission(sessionId: string, submission: ExternalSignatureSubmission): SigningSubmissionResult | null {
  const session = getSigningSession(sessionId);
  if (!session) return null;

  const result = addExternalSignatureSubmission(session, submission);
  if (result.accepted) sessions.set(sessionId, result.session);
  return result;
}

export function resetSigningSessionsForTests(): void {
  sessions.clear();
}
