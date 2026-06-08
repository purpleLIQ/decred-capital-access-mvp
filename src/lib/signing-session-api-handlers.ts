import { formatSchemaError, signingSessionCreateRequestSchema, signingSubmissionRequestSchema } from "./api-schemas";
import { addSigningSubmission, createAndStoreSigningSession, listSigningSessions } from "./signing-session-store";

export interface ApiHandlerResponse<T> {
  status: number;
  body: T;
}

export function handleListSigningSessions(): ApiHandlerResponse<{ sessions: ReturnType<typeof listSigningSessions> }> {
  return { status: 200, body: { sessions: listSigningSessions() } };
}

export function handleCreateSigningSession(input: unknown): ApiHandlerResponse<Record<string, unknown>> {
  const parsed = signingSessionCreateRequestSchema.safeParse(input);

  if (!parsed.success) {
    return { status: 400, body: { error: formatSchemaError(parsed.error) } };
  }

  const session = createAndStoreSigningSession(parsed.data.review);
  return {
    status: 200,
    body: {
      session,
      canSubmitSignatures: session.status === "collecting",
    },
  };
}

export function handleAddSigningSubmission(input: unknown): ApiHandlerResponse<Record<string, unknown>> {
  const parsed = signingSubmissionRequestSchema.safeParse(input);

  if (!parsed.success) {
    return { status: 400, body: { error: formatSchemaError(parsed.error) } };
  }

  const result = addSigningSubmission(parsed.data.sessionId, {
    role: parsed.data.role,
    signedTransactionHex: parsed.data.signedTransactionHex,
    signerAddress: parsed.data.signerAddress,
    note: parsed.data.note,
    submittedAt: new Date().toISOString(),
  });

  if (!result) {
    return { status: 404, body: { error: "Signing session not found." } };
  }

  if (!result.accepted) {
    return { status: 400, body: { session: result.session, accepted: false, blockers: result.blockers } };
  }

  return { status: 200, body: { session: result.session, accepted: true, blockers: [] } };
}
