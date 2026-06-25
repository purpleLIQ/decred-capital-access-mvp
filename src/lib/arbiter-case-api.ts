import { z } from "zod";
import { formatSchemaError } from "./api-schemas";
import type { HeadlessLifecycleEvent } from "./headless-lifecycle-events";
import { createHeadlessLifecycleEvent } from "./headless-lifecycle-events";
import type { HeadlessLoanLifecycleRecord } from "./headless-loan-lifecycle";
import type { HeadlessLifecycleStore } from "./headless-lifecycle-store";
import type { HeadlessLifecycleEventStore } from "./lifecycle-event-store";
import type { ArbiterActionDecision, ArbiterActionKind, ArbiterReviewCase } from "./arbiter-review-cases";
import { deriveArbiterReviewCases } from "./arbiter-review-cases";
import type { ArbiterCaseStore } from "./arbiter-case-store";
import { arbiterCaseStore } from "./arbiter-case-store";
import { submitHeadlessLifecycleEvent } from "./headless-lifecycle-event-api";

export interface ArbiterCaseApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

const listSchema = z.object({
  lookupCode: z.string().trim().max(120).optional(),
  caseId: z.string().trim().max(160).optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(25),
});

const decisionSchema = z.object({
  caseId: z.string().trim().min(1).max(160),
  actionKind: z.enum(["request_more_evidence", "recognize_repayment", "recognize_top_up", "pause_liquidation", "mark_dispute", "resolve_case", "confirm_liquidation_review"]),
  decidedBy: z.string().trim().min(1).max(160).optional().default("arbiter-placeholder"),
  note: z.string().trim().min(1).max(1000),
  decidedAt: z.string().datetime().optional(),
  repaymentAmount: z.coerce.number().nonnegative().optional(),
});

export async function deriveAndStoreArbiterCases(input: {
  record: HeadlessLoanLifecycleRecord;
  recentEvents?: HeadlessLifecycleEvent[];
  manualReviewReason?: string;
  now?: string;
  stores?: {
    arbiterStore?: ArbiterCaseStore;
    lifecycleStore?: HeadlessLifecycleStore;
    eventStore?: HeadlessLifecycleEventStore;
  };
}): Promise<ArbiterCaseApiResult<{ cases: ArbiterReviewCase[]; lifecycleEvents: HeadlessLifecycleEvent[] }>> {
  const arbiterStore = input.stores?.arbiterStore ?? arbiterCaseStore;
  const cases = deriveArbiterReviewCases({ record: input.record, recentEvents: input.recentEvents, manualReviewReason: input.manualReviewReason, now: input.now });
  const lifecycleEvents: HeadlessLifecycleEvent[] = [];

  for (const reviewCase of cases) {
    await arbiterStore.upsert(reviewCase);
    const event = createHeadlessLifecycleEvent({
      lookupCode: reviewCase.lookupCode,
      kind: "arbiter_review_requested",
      source: "system",
      observedAt: reviewCase.openedAt,
      createdAt: reviewCase.openedAt,
      externalReference: reviewCase.caseId,
      safetyAuditNote: reviewCase.safetyAuditNote,
      payload: {
        detail: `Arbiter case opened: ${reviewCase.caseType}. ${reviewCase.reason}`,
        reviewId: reviewCase.caseId,
      },
    });
    const submitted = await submitHeadlessLifecycleEvent(event, { lifecycleStore: input.stores?.lifecycleStore, eventStore: input.stores?.eventStore });
    if (submitted.ok && submitted.data?.event) lifecycleEvents.push(submitted.data.event);
  }

  return { ok: true, status: 201, data: { cases, lifecycleEvents } };
}

export async function listArbiterCases(input: unknown, store: ArbiterCaseStore = arbiterCaseStore): Promise<ArbiterCaseApiResult<{ cases: ArbiterReviewCase[] }>> {
  const parsed = listSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, error: formatSchemaError(parsed.error) };

  if (parsed.data.caseId) {
    const reviewCase = await store.findById(parsed.data.caseId);
    return { ok: true, status: 200, data: { cases: reviewCase ? [reviewCase] : [] } };
  }

  const cases = parsed.data.lookupCode
    ? await store.listByLookupCode(parsed.data.lookupCode, parsed.data.limit)
    : await store.listOpen(parsed.data.limit);
  return { ok: true, status: 200, data: { cases } };
}

export async function recordArbiterActionDecision(
  input: unknown,
  stores: {
    arbiterStore?: ArbiterCaseStore;
    lifecycleStore?: HeadlessLifecycleStore;
    eventStore?: HeadlessLifecycleEventStore;
  } = {},
): Promise<ArbiterCaseApiResult<{ case: ArbiterReviewCase; decision: ArbiterActionDecision; lifecycleEvent?: HeadlessLifecycleEvent }>> {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, error: formatSchemaError(parsed.error) };

  const arbiterStore = stores.arbiterStore ?? arbiterCaseStore;
  const reviewCase = await arbiterStore.findById(parsed.data.caseId);
  if (!reviewCase) return { ok: false, status: 404, error: "Arbiter case not found." };

  const action = reviewCase.allowedActions.find((item) => item.kind === parsed.data.actionKind);
  const decidedAt = parsed.data.decidedAt ?? new Date().toISOString();
  const blocked = !action?.allowed;
  const lifecycleEvent = blocked ? undefined : createLifecycleEventForDecision(reviewCase, parsed.data.actionKind, parsed.data.note, decidedAt, parsed.data.repaymentAmount);
  const decision: ArbiterActionDecision = {
    decisionId: `arb-decision-${decidedAt.replace(/[^0-9]/g, "").slice(0, 14)}-${reviewCase.caseId}-${parsed.data.actionKind}`,
    caseId: reviewCase.caseId,
    actionKind: parsed.data.actionKind,
    decidedAt,
    decidedBy: parsed.data.decidedBy,
    status: blocked ? "blocked" : "recorded",
    note: blocked ? action?.blockerReason ?? "Action is blocked for this case." : parsed.data.note,
    lifecycleEvent,
    safetyNote: action?.safetyNote ?? "Arbiter action decision recorded without signing, broadcast, or funds movement.",
  };

  const updatedCase = await arbiterStore.recordDecision(reviewCase.caseId, decision);
  if (!updatedCase) return { ok: false, status: 404, error: "Arbiter case not found." };

  let submittedEvent: HeadlessLifecycleEvent | undefined;
  if (lifecycleEvent) {
    lifecycleEvent.payload.arbiterDecisionId = decision.decisionId;
    const submitted = await submitHeadlessLifecycleEvent(lifecycleEvent, { lifecycleStore: stores.lifecycleStore, eventStore: stores.eventStore });
    if (submitted.ok) submittedEvent = submitted.data?.event;
  }

  return { ok: true, status: 200, data: { case: updatedCase, decision, lifecycleEvent: submittedEvent } };
}

function createLifecycleEventForDecision(
  reviewCase: ArbiterReviewCase,
  actionKind: ArbiterActionKind,
  note: string,
  decidedAt: string,
  repaymentAmount?: number,
): HeadlessLifecycleEvent {
  const base = {
    lookupCode: reviewCase.lookupCode,
    source: "arbiter" as const,
    observedAt: decidedAt,
    createdAt: decidedAt,
    externalReference: reviewCase.caseId,
    safetyAuditNote: "Arbiter action recorded as review workflow only. No liquidation execution, signing, broadcast, payout, or fund movement occurred.",
  };

  if (actionKind === "resolve_case" || actionKind === "confirm_liquidation_review") {
    return createHeadlessLifecycleEvent({
      ...base,
      kind: "arbiter_review_resolved",
      payload: { detail: `${labelForAction(actionKind)}: ${note}`, reviewId: reviewCase.caseId },
    });
  }

  if (actionKind === "recognize_repayment") {
    return createHeadlessLifecycleEvent({
      ...base,
      kind: "repayment_observed",
      payload: { detail: `Arbiter recognized repayment evidence: ${note}`, reviewId: reviewCase.caseId, repaymentAmount, amount: repaymentAmount },
    });
  }

  return createHeadlessLifecycleEvent({
    ...base,
    kind: "arbiter_review_requested",
    payload: { detail: `${labelForAction(actionKind)}: ${note}`, reviewId: reviewCase.caseId },
  });
}

function labelForAction(actionKind: ArbiterActionKind): string {
  switch (actionKind) {
    case "request_more_evidence":
      return "More evidence requested";
    case "recognize_repayment":
      return "Repayment recognized";
    case "recognize_top_up":
      return "Top-up recognized";
    case "pause_liquidation":
      return "Review path paused";
    case "mark_dispute":
      return "Dispute marked";
    case "resolve_case":
      return "Review resolved";
    case "confirm_liquidation_review":
      return "Liquidation review confirmed for later gated review path";
  }
}
