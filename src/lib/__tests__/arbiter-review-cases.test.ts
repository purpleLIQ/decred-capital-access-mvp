import { describe, expect, it } from "vitest";

import { createHeadlessLifecycleEvent, type HeadlessLifecycleEvent } from "../headless-lifecycle-events";
import { createHeadlessLoanLifecycleRecord, type HeadlessLoanLifecycleRecord, type OptionalBorrowerContact, type LifecycleStatusSection } from "../headless-loan-lifecycle";
import type { HeadlessLifecycleStore, LifecycleStatusSectionKey } from "../headless-lifecycle-store";
import type { HeadlessLifecycleEventStore } from "../lifecycle-event-store";
import type { ArbiterActionDecision, ArbiterCaseStatus, ArbiterReviewCase } from "../arbiter-review-cases";
import { deriveArbiterReviewCases } from "../arbiter-review-cases";
import type { ArbiterCaseStore } from "../arbiter-case-store";
import { deriveAndStoreArbiterCases, recordArbiterActionDecision } from "../arbiter-case-api";

class MemoryLifecycleStore implements HeadlessLifecycleStore {
  records: HeadlessLoanLifecycleRecord[] = [];

  async save(record: HeadlessLoanLifecycleRecord) {
    this.records = [record, ...this.records.filter((existing) => existing.lookupCode !== record.lookupCode)];
    return record;
  }

  async findByLookupCode(lookupCode: string) {
    return this.records.find((record) => record.lookupCode.toUpperCase() === lookupCode.trim().toUpperCase()) ?? null;
  }

  async listRecent(limit = 10) {
    return this.records.slice(0, limit);
  }

  async updateBorrowerContact(lookupCode: string, contact: OptionalBorrowerContact) {
    const record = await this.findByLookupCode(lookupCode);
    if (!record) return null;
    const nextRecord = { ...record, borrowerContact: contact };
    await this.save(nextRecord);
    return nextRecord;
  }

  async updateStatusSection(lookupCode: string, _section: LifecycleStatusSectionKey, _patch: Partial<LifecycleStatusSection<string>>) {
    return this.findByLookupCode(lookupCode);
  }
}

class MemoryEventStore implements HeadlessLifecycleEventStore {
  events: HeadlessLifecycleEvent[] = [];

  async save(event: HeadlessLifecycleEvent) {
    this.events = [event, ...this.events.filter((existing) => existing.id !== event.id)];
    return event;
  }

  async listByLookupCode(lookupCode: string, limit = 20) {
    return this.events.filter((event) => event.lookupCode.toUpperCase() === lookupCode.trim().toUpperCase()).slice(0, limit);
  }

  async listRecent(limit = 25) {
    return this.events.slice(0, limit);
  }
}

class MemoryArbiterCaseStore implements ArbiterCaseStore {
  cases: ArbiterReviewCase[] = [];

  async upsert(reviewCase: ArbiterReviewCase) {
    this.cases = [reviewCase, ...this.cases.filter((existing) => existing.caseId !== reviewCase.caseId)];
    return reviewCase;
  }

  async findById(caseId: string) {
    return this.cases.find((reviewCase) => reviewCase.caseId === caseId) ?? null;
  }

  async listOpen(limit = 25) {
    return this.cases.filter((reviewCase) => !["resolved", "closed"].includes(reviewCase.status)).slice(0, limit);
  }

  async listByLookupCode(lookupCode: string, limit = 25) {
    return this.cases.filter((reviewCase) => reviewCase.lookupCode === lookupCode).slice(0, limit);
  }

  async updateStatus(caseId: string, status: ArbiterCaseStatus, updatedAt = "2026-06-16T22:00:00.000Z") {
    const reviewCase = await this.findById(caseId);
    if (!reviewCase) return null;
    const nextCase = { ...reviewCase, status, updatedAt };
    await this.upsert(nextCase);
    return nextCase;
  }

  async recordDecision(caseId: string, decision: ArbiterActionDecision) {
    const reviewCase = await this.findById(caseId);
    if (!reviewCase) return null;
    const status = decision.status === "blocked" ? "blocked" : decision.actionKind === "resolve_case" ? "resolved" : decision.actionKind === "confirm_liquidation_review" ? "action_required" : "under_review";
    const nextCase: ArbiterReviewCase = { ...reviewCase, status, updatedAt: decision.decidedAt, decisions: [decision, ...reviewCase.decisions] };
    await this.upsert(nextCase);
    return nextCase;
  }
}

function seededRecord() {
  return createHeadlessLoanLifecycleRecord({
    publicLoanReference: "DCL-ARB-001",
    collateralDcr: 100,
    borrowAmount: 1000,
    borrowAsset: "USDC",
    borrowerAcceptedQuote: true,
    repaymentAmount: 0,
  });
}

function eventWithPayload(record: HeadlessLoanLifecycleRecord, payload: HeadlessLifecycleEvent["payload"]): HeadlessLifecycleEvent {
  return createHeadlessLifecycleEvent({
    lookupCode: record.lookupCode,
    kind: payload.repaymentVerifierStatus ? "repayment_observed" : payload.platformFeeVerifierStatus ? "dcr_platform_fee_output_observed" : "collateral_lock_observed",
    source: "system",
    observedAt: "2026-06-16T22:00:00.000Z",
    createdAt: "2026-06-16T22:00:00.000Z",
    payload,
  });
}

describe("arbiter review cases", () => {
  it("does not derive cases for a healthy lifecycle without review signals", () => {
    const cases = deriveArbiterReviewCases({ record: seededRecord(), recentEvents: [], now: "2026-06-16T22:00:00.000Z" });
    expect(cases).toHaveLength(0);
  });

  it("derives cases for platform fee, stale watcher, repayment, health, and evidence signals", () => {
    const base = seededRecord();
    const feeRecord = { ...base, dcrPlatformFeeOutput: { ...base.dcrPlatformFeeOutput, status: "not_started" as const } };
    const feeCases = deriveArbiterReviewCases({ record: feeRecord, recentEvents: [eventWithPayload(base, { detail: "fee missing", platformFeeVerifierStatus: "missing", watcherEventId: "watch-fee" })], now: "2026-06-16T22:00:00.000Z" });
    const staleCases = deriveArbiterReviewCases({ record: { ...base, collateralLock: { ...base.collateralLock, status: "failed" as const } }, recentEvents: [eventWithPayload(base, { detail: "stale", collateralVerifierStatus: "stale", watcherRiskStatus: "stale", watcherEventId: "watch-stale" })], now: "2026-06-16T22:00:00.000Z" });
    const repaymentCases = deriveArbiterReviewCases({ record: base, recentEvents: [eventWithPayload(base, { detail: "repayment mismatch", repaymentVerifierStatus: "asset_mismatch", watcherEventId: "watch-repay" })], now: "2026-06-16T22:00:00.000Z" });
    const healthCases = deriveArbiterReviewCases({ record: { ...base, liquidationHealth: { ...base.liquidationHealth, status: "liquidation_review" as const } }, recentEvents: [], now: "2026-06-16T22:00:00.000Z" });
    const evidenceCases = deriveArbiterReviewCases({ record: { ...base, evidenceBundle: { ...base.evidenceBundle, timestamp: { ...base.evidenceBundle.timestamp, status: "failed" as const } } }, recentEvents: [], now: "2026-06-16T22:00:00.000Z" });

    expect(feeCases.some((reviewCase) => reviewCase.caseType === "platform_fee_issue")).toBe(true);
    expect(staleCases.some((reviewCase) => reviewCase.caseType === "watcher_stale_or_reorged")).toBe(true);
    expect(repaymentCases.some((reviewCase) => reviewCase.caseType === "repayment_dispute")).toBe(true);
    expect(healthCases.some((reviewCase) => reviewCase.caseType === "liquidation_health_review")).toBe(true);
    expect(evidenceCases.some((reviewCase) => reviewCase.caseType === "evidence_incomplete")).toBe(true);
  });

  it("stores derived cases and emits arbiter review requested events", async () => {
    const lifecycleStore = new MemoryLifecycleStore();
    const eventStore = new MemoryEventStore();
    const arbiterStore = new MemoryArbiterCaseStore();
    const record = seededRecord();
    await lifecycleStore.save(record);
    const recentEvent = eventWithPayload(record, { detail: "fee missing", platformFeeVerifierStatus: "missing", watcherEventId: "watch-fee" });
    const feeRecord = { ...record, dcrPlatformFeeOutput: { ...record.dcrPlatformFeeOutput, status: "not_started" as const } };
    await lifecycleStore.save(feeRecord);

    const result = await deriveAndStoreArbiterCases({
      record: feeRecord,
      recentEvents: [recentEvent],
      now: "2026-06-16T22:00:00.000Z",
      stores: { lifecycleStore, eventStore, arbiterStore },
    });

    expect(result.ok).toBe(true);
    expect(result.data?.cases).toHaveLength(1);
    expect(arbiterStore.cases).toHaveLength(1);
    expect(eventStore.events[0].kind).toBe("arbiter_review_requested");
    expect((await lifecycleStore.findByLookupCode(record.lookupCode))?.arbiterReview.status).toBe("requested");
  });

  it("records allowed and blocked arbiter decisions through the lifecycle path", async () => {
    const lifecycleStore = new MemoryLifecycleStore();
    const eventStore = new MemoryEventStore();
    const arbiterStore = new MemoryArbiterCaseStore();
    const record = {
      ...seededRecord(),
      evidenceBundle: { ...seededRecord().evidenceBundle, status: "prepared" as const },
      liquidationHealth: { ...seededRecord().liquidationHealth, status: "liquidation_review" as const },
    };
    await lifecycleStore.save(record);
    const [reviewCase] = deriveArbiterReviewCases({ record, now: "2026-06-16T22:00:00.000Z" });
    await arbiterStore.upsert(reviewCase);

    const blocked = await recordArbiterActionDecision({
      caseId: reviewCase.caseId,
      actionKind: "recognize_top_up",
      note: "top up requested",
      decidedAt: "2026-06-16T22:10:00.000Z",
    }, { lifecycleStore, eventStore, arbiterStore });
    const resolved = await recordArbiterActionDecision({
      caseId: reviewCase.caseId,
      actionKind: "confirm_liquidation_review",
      note: "review criteria documented for later gated flow",
      decidedAt: "2026-06-16T22:11:00.000Z",
    }, { lifecycleStore, eventStore, arbiterStore });

    expect(blocked.data?.decision.status).toBe("blocked");
    expect(resolved.data?.decision.status).toBe("recorded");
    expect(resolved.data?.lifecycleEvent?.kind).toBe("arbiter_review_resolved");
    expect(eventStore.events.some((event) => event.kind === "arbiter_review_resolved")).toBe(true);
  });
});
