import { z } from "zod";
import { formatSchemaError } from "./api-schemas";
import type { ArbiterCaseStore } from "./arbiter-case-store";
import { arbiterCaseStore } from "./arbiter-case-store";
import type { HeadlessLifecycleStore } from "./headless-lifecycle-store";
import { headlessLifecycleStore } from "./headless-lifecycle-store";
import type { HeadlessLifecycleEventStore } from "./lifecycle-event-store";
import { lifecycleEventStore } from "./lifecycle-event-store";
import { createFixtureSimnetProofSession, type SimnetProofSession } from "./simnet-proof-readiness";
import type { SimnetProofSessionStore } from "./simnet-proof-readiness-store";
import { simnetProofSessionStore } from "./simnet-proof-readiness-store";

export interface SimnetProofReadinessApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export interface RefreshedSimnetProofSession {
  session: SimnetProofSession;
  eventCount: number;
  reviewCaseCount: number;
  safetyNote: string;
}

const listSessionsSchema = z.object({
  lookupCode: z.string().trim().max(120).optional(),
  proofSessionId: z.string().trim().max(160).optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
});

const refreshSessionSchema = z.object({
  lookupCode: z.string().trim().min(1).max(120),
  now: z.string().datetime().optional(),
});

export async function listSimnetProofSessions(
  input: unknown,
  store: SimnetProofSessionStore = simnetProofSessionStore,
): Promise<SimnetProofReadinessApiResult<{ sessions: SimnetProofSession[] }>> {
  const parsed = listSessionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, error: formatSchemaError(parsed.error) };

  if (parsed.data.proofSessionId) {
    const session = await store.findById(parsed.data.proofSessionId);
    return { ok: true, status: 200, data: { sessions: session ? [session] : [] } };
  }

  const sessions = parsed.data.lookupCode
    ? await store.listByLookupCode(parsed.data.lookupCode, parsed.data.limit)
    : await store.listRecent(parsed.data.limit);

  return { ok: true, status: 200, data: { sessions } };
}

export async function refreshSimnetProofSession(
  input: unknown,
  stores: {
    lifecycleStore?: HeadlessLifecycleStore;
    eventStore?: HeadlessLifecycleEventStore;
    arbiterStore?: ArbiterCaseStore;
    sessionStore?: SimnetProofSessionStore;
  } = {},
): Promise<SimnetProofReadinessApiResult<RefreshedSimnetProofSession>> {
  const parsed = refreshSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, error: formatSchemaError(parsed.error) };

  const lifecycleStore = stores.lifecycleStore ?? headlessLifecycleStore;
  const eventStore = stores.eventStore ?? lifecycleEventStore;
  const arbiterStore = stores.arbiterStore ?? arbiterCaseStore;
  const sessionStore = stores.sessionStore ?? simnetProofSessionStore;
  const record = await lifecycleStore.findByLookupCode(parsed.data.lookupCode);
  if (!record) return { ok: false, status: 404, error: "Lifecycle record not found." };

  const [recentEvents, reviewCases] = await Promise.all([
    eventStore.listByLookupCode(record.lookupCode, 50),
    arbiterStore.listByLookupCode(record.lookupCode, 50),
  ]);
  const session = createFixtureSimnetProofSession(record, {
    recentEvents,
    reviewCases,
    now: parsed.data.now,
  });
  const savedSession = await sessionStore.upsert(session);

  return {
    ok: true,
    status: 201,
    data: {
      session: savedSession,
      eventCount: recentEvents.length,
      reviewCaseCount: reviewCases.length,
      safetyNote: "Simnet proof readiness refresh is review-only. No signing, no broadcast, no mainnet, no real transactions, and no funds movement occurred.",
    },
  };
}
