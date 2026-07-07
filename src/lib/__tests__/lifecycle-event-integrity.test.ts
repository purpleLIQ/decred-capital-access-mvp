import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { submitHeadlessLifecycleEvent } from "../headless-lifecycle-event-api";
import type { ArbiterActionDecision, ArbiterCaseStatus, ArbiterReviewCase } from "../arbiter-review-cases";
import type { ArbiterCaseStore } from "../arbiter-case-store";
import { createHeadlessLoanLifecycleRecord, type HeadlessLoanLifecycleRecord, type LifecycleStatusSection, type OptionalBorrowerContact } from "../headless-loan-lifecycle";
import type { HeadlessLifecycleStore, LifecycleStatusSectionKey } from "../headless-lifecycle-store";
import type { HeadlessLifecycleEvent } from "../headless-lifecycle-events";
import type { HeadlessLifecycleEventStore } from "../lifecycle-event-store";

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
    void _section;
    void _patch;
    return this.findByLookupCode(lookupCode);
  }
}

class MemoryEventStore implements HeadlessLifecycleEventStore {
  events: HeadlessLifecycleEvent[] = [];

  async save(event: HeadlessLifecycleEvent) {
    this.events = [event, ...this.events.filter((existing) => existing.id !== event.id)];
    return event;
  }

  async findByEventId(eventId: string) {
    return this.events.find((event) => event.id === eventId) ?? null;
  }

  async findByExternalReference(lookupCode: string, externalReference: string) {
    return this.events.find((event) => event.lookupCode === lookupCode && event.externalReference === externalReference) ?? null;
  }

  async findByWatcherEventId(lookupCode: string, watcherEventId: string) {
    return this.events.find((event) => event.lookupCode === lookupCode && event.payload.watcherEventId === watcherEventId) ?? null;
  }

  async findByHealthResultId(lookupCode: string, healthResultId: string) {
    return this.events.find((event) => event.lookupCode === lookupCode && event.payload.healthResultId === healthResultId) ?? null;
  }

  async findByArbiterDecisionId(lookupCode: string, arbiterDecisionId: string) {
    return this.events.find((event) => event.lookupCode === lookupCode && event.payload.arbiterDecisionId === arbiterDecisionId) ?? null;
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
    const existing = this.cases.find((item) => item.caseId === reviewCase.caseId);
    const nextCase = existing
      ? { ...existing, ...reviewCase, openedAt: existing.openedAt, decisions: reviewCase.decisions.length ? reviewCase.decisions : existing.decisions }
      : reviewCase;
    this.cases = [nextCase, ...this.cases.filter((item) => item.caseId !== reviewCase.caseId)];
    return nextCase;
  }

  async findById(caseId: string) {
    return this.cases.find((reviewCase) => reviewCase.caseId === caseId) ?? null;
  }

  async listOpen(limit = 25) {
    return this.cases.filter((reviewCase) => !["resolved", "closed"].includes(reviewCase.status)).slice(0, limit);
  }

  async listByLookupCode(lookupCode: string, limit = 25) {
    return this.cases.filter((reviewCase) => reviewCase.lookupCode.toUpperCase() === lookupCode.trim().toUpperCase()).slice(0, limit);
  }

  async updateStatus(caseId: string, status: ArbiterCaseStatus, updatedAt = "2026-06-15T22:00:00.000Z") {
    const reviewCase = await this.findById(caseId);
    if (!reviewCase) return null;
    const nextCase = { ...reviewCase, status, updatedAt };
    await this.upsert(nextCase);
    return nextCase;
  }

  async recordDecision(caseId: string, decision: ArbiterActionDecision) {
    const reviewCase = await this.findById(caseId);
    if (!reviewCase) return null;
    const nextCase: ArbiterReviewCase = { ...reviewCase, decisions: [decision, ...reviewCase.decisions], updatedAt: decision.decidedAt };
    await this.upsert(nextCase);
    return nextCase;
  }
}

function setup(publicLoanReference = "DCL-INTEGRITY-001") {
  const lifecycleStore = new MemoryLifecycleStore();
  const eventStore = new MemoryEventStore();
  const arbiterStore = new MemoryArbiterCaseStore();
  const record = createHeadlessLoanLifecycleRecord({
    publicLoanReference,
    collateralDcr: 100,
    borrowAmount: 1_000,
    borrowAsset: "USDC",
    borrowerAcceptedQuote: true,
    repaymentAmount: 0,
    now: "2026-06-15T22:00:00.000Z",
  });
  void lifecycleStore.save(record);
  return { lifecycleStore, eventStore, arbiterStore, record };
}

describe("lifecycle event integrity gate", () => {
  it("accepts normal events and returns integrity metadata", async () => {
    const { lifecycleStore, eventStore, arbiterStore, record } = setup();

    const submitted = await submitHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "supplier_disbursement_observed",
      source: "watcher",
      observedAt: "2026-06-15T22:10:00.000Z",
      createdAt: "2026-06-15T22:10:00.000Z",
      payload: { detail: "Supplier disbursement observed.", txid: "tx-disburse-1", watcherEventId: "watch-disburse-1" },
    }, { lifecycleStore, eventStore, arbiterStore });

    expect(submitted.status).toBe(201);
    expect(submitted.data?.integrity.status).toBe("accepted");
    expect(submitted.data?.integrity.applied).toBe(true);
    expect(submitted.data?.event.payload.integrityStatus).toBe("accepted");
    expect(submitted.data?.record.supplierDisbursement.status).toBe("disbursed");
  });

  it("no-ops duplicate event ids without replacing the accepted event", async () => {
    const { lifecycleStore, eventStore, arbiterStore, record } = setup("DCL-INTEGRITY-DUP-ID");
    const input = {
      lookupCode: record.lookupCode,
      kind: "collateral_lock_observed",
      source: "watcher",
      observedAt: "2026-06-15T22:10:00.000Z",
      createdAt: "2026-06-15T22:10:00.000Z",
      payload: { detail: "Collateral confirmed.", watcherEventId: "watch-collateral-1", collateralVerifierStatus: "confirmed" },
    };

    const first = await submitHeadlessLifecycleEvent(input, { lifecycleStore, eventStore, arbiterStore });
    const second = await submitHeadlessLifecycleEvent(input, { lifecycleStore, eventStore, arbiterStore });

    expect(first.data?.integrity.status).toBe("accepted");
    expect(second.status).toBe(202);
    expect(second.data?.integrity.status).toBe("duplicate");
    expect(second.data?.integrity.applied).toBe(false);
    expect(second.data?.integrityReview.recommended).toBe(false);
    expect(eventStore.events).toHaveLength(1);
    expect(arbiterStore.cases).toHaveLength(0);
    expect((await lifecycleStore.findByLookupCode(record.lookupCode))?.collateralLock.status).toBe("locked");
  });

  it("no-ops duplicate watcher event ids for the same lifecycle event kind", async () => {
    const { lifecycleStore, eventStore, arbiterStore, record } = setup("DCL-INTEGRITY-WATCHER");

    await submitHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "collateral_lock_observed",
      source: "watcher",
      observedAt: "2026-06-15T22:10:00.000Z",
      createdAt: "2026-06-15T22:10:00.000Z",
      payload: { detail: "Collateral confirmed.", watcherEventId: "watch-collateral-repeat", collateralVerifierStatus: "confirmed" },
    }, { lifecycleStore, eventStore, arbiterStore });

    const replayed = await submitHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "collateral_lock_observed",
      source: "watcher",
      observedAt: "2026-06-15T22:11:00.000Z",
      createdAt: "2026-06-15T22:11:00.000Z",
      payload: { detail: "Collateral replay.", watcherEventId: "watch-collateral-repeat", collateralVerifierStatus: "confirmed" },
    }, { lifecycleStore, eventStore, arbiterStore });

    expect(replayed.status).toBe(202);
    expect(replayed.data?.integrity.status).toBe("replayed");
    expect(replayed.data?.integrityReview.recommended).toBe(false);
    expect(replayed.data?.event.payload.integrityApplied).toBe(false);
    expect(arbiterStore.cases).toHaveLength(0);
    expect(eventStore.events).toHaveLength(2);
  });

  it("no-ops duplicate oracle health result ids for the same event kind", async () => {
    const { lifecycleStore, eventStore, arbiterStore, record } = setup("DCL-INTEGRITY-HEALTH");

    await submitHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "liquidation_health_updated",
      source: "oracle",
      observedAt: "2026-06-15T22:10:00.000Z",
      createdAt: "2026-06-15T22:10:00.000Z",
      payload: { detail: "Warning health.", health: "warning", status: "warning", healthResultId: "health-repeat-1", ltvBps: 7_000 },
    }, { lifecycleStore, eventStore, arbiterStore });

    const replayed = await submitHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "liquidation_health_updated",
      source: "oracle",
      observedAt: "2026-06-15T22:11:00.000Z",
      createdAt: "2026-06-15T22:11:00.000Z",
      payload: { detail: "Repeated health.", health: "healthy", status: "healthy", healthResultId: "health-repeat-1", ltvBps: 2_000 },
    }, { lifecycleStore, eventStore, arbiterStore });

    expect(replayed.data?.integrity.status).toBe("replayed");
    expect(replayed.data?.integrityReview.recommended).toBe(false);
    expect(arbiterStore.cases).toHaveLength(0);
    expect((await lifecycleStore.findByLookupCode(record.lookupCode))?.liquidationHealth.status).toBe("warning");
  });

  it("no-ops duplicate arbiter decision ids", async () => {
    const { lifecycleStore, eventStore, arbiterStore, record } = setup("DCL-INTEGRITY-ARB-DUP");

    await submitHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "arbiter_review_resolved",
      source: "arbiter",
      observedAt: "2026-06-15T22:10:00.000Z",
      createdAt: "2026-06-15T22:10:00.000Z",
      payload: { detail: "Resolved.", reviewId: "review-1", arbiterDecisionId: "arb-decision-repeat" },
    }, { lifecycleStore, eventStore, arbiterStore });

    const replayed = await submitHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "arbiter_review_resolved",
      source: "arbiter",
      observedAt: "2026-06-15T22:11:00.000Z",
      createdAt: "2026-06-15T22:11:00.000Z",
      payload: { detail: "Resolved again.", reviewId: "review-1", arbiterDecisionId: "arb-decision-repeat" },
    }, { lifecycleStore, eventStore, arbiterStore });

    expect(replayed.data?.integrity.status).toBe("replayed");
    expect(replayed.data?.integrity.applied).toBe(false);
    expect(replayed.data?.integrityReview.recommended).toBe(false);
    expect(arbiterStore.cases).toHaveLength(0);
  });

  it("blocks stale watcher events from overwriting newer confirmed state", async () => {
    const { lifecycleStore, eventStore, arbiterStore, record } = setup("DCL-INTEGRITY-STALE-WATCHER");

    await submitHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "collateral_lock_observed",
      source: "watcher",
      observedAt: "2026-06-15T22:10:00.000Z",
      createdAt: "2026-06-15T22:10:00.000Z",
      payload: { detail: "Collateral confirmed.", watcherEventId: "watch-collateral-new", collateralVerifierStatus: "confirmed" },
    }, { lifecycleStore, eventStore, arbiterStore });

    const stale = await submitHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "collateral_lock_observed",
      source: "watcher",
      observedAt: "2026-06-15T22:05:00.000Z",
      createdAt: "2026-06-15T22:12:00.000Z",
      payload: { detail: "Old stale collateral observation.", watcherEventId: "watch-collateral-old", watcherRiskStatus: "stale", collateralVerifierStatus: "stale" },
    }, { lifecycleStore, eventStore, arbiterStore });

    expect(stale.data?.integrity.status).toBe("stale");
    expect(stale.data?.integrityReview).toMatchObject({
      recommended: true,
      action: "opened",
      caseType: "watcher_stale_or_reorged",
      borrowerSummary: "Review in progress",
    });
    expect(stale.data?.event.payload.integrityReview?.caseId).toBe(stale.data?.integrityReview.caseId);
    expect(arbiterStore.cases).toHaveLength(1);
    expect(arbiterStore.cases[0].caseType).toBe("watcher_stale_or_reorged");
    expect((await lifecycleStore.findByLookupCode(record.lookupCode))?.collateralLock.status).toBe("locked");
    expect((await lifecycleStore.findByLookupCode(record.lookupCode))?.arbiterReview.status).toBe("requested");
  });

  it("blocks stale oracle health results that would make the loan safer", async () => {
    const { lifecycleStore, eventStore, arbiterStore, record } = setup("DCL-INTEGRITY-STALE-ORACLE");

    await submitHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "liquidation_health_updated",
      source: "oracle",
      observedAt: "2026-06-15T22:10:00.000Z",
      createdAt: "2026-06-15T22:10:00.000Z",
      payload: { detail: "Warning health.", health: "warning", status: "warning", healthResultId: "health-warning-1" },
    }, { lifecycleStore, eventStore, arbiterStore });

    const stale = await submitHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "liquidation_health_updated",
      source: "oracle",
      observedAt: "2026-06-15T22:05:00.000Z",
      createdAt: "2026-06-15T22:12:00.000Z",
      payload: { detail: "Old healthy health.", health: "healthy", status: "healthy", healthResultId: "health-healthy-old" },
    }, { lifecycleStore, eventStore, arbiterStore });

    expect(stale.data?.integrity.status).toBe("stale");
    expect(stale.data?.integrityReview).toMatchObject({
      recommended: true,
      action: "opened",
      caseType: "liquidation_health_review",
      borrowerSummary: "Loan health review open",
    });
    expect(arbiterStore.cases).toHaveLength(1);
    expect(arbiterStore.cases[0].caseType).toBe("liquidation_health_review");
    expect((await lifecycleStore.findByLookupCode(record.lookupCode))?.liquidationHealth.status).toBe("warning");
  });

  it("blocks repayment mismatches from completing repayment", async () => {
    const { lifecycleStore, eventStore, arbiterStore, record } = setup("DCL-INTEGRITY-REPAY-MISMATCH");

    const mismatch = await submitHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "repayment_observed",
      source: "watcher",
      observedAt: "2026-06-15T22:10:00.000Z",
      createdAt: "2026-06-15T22:10:00.000Z",
      payload: { detail: "Repayment mismatch.", watcherEventId: "watch-repay-mismatch", repaymentVerifierStatus: "amount_mismatch", repaymentAmount: record.repaymentAllocationPreview.totalDue },
    }, { lifecycleStore, eventStore, arbiterStore });

    expect(mismatch.data?.integrity.status).toBe("contradictory");
    expect(mismatch.data?.integrityReview).toMatchObject({
      recommended: true,
      action: "opened",
      caseType: "repayment_dispute",
      borrowerSummary: "Repayment review open",
    });
    expect(arbiterStore.cases).toHaveLength(1);
    expect(arbiterStore.cases[0].caseType).toBe("repayment_dispute");
    expect((await lifecycleStore.findByLookupCode(record.lookupCode))?.repaymentDetection.status).toBe("watcher_placeholder");
  });

  it("blocks older partial repayment from rolling back full repayment", async () => {
    const { lifecycleStore, eventStore, arbiterStore, record } = setup("DCL-INTEGRITY-REPAY-ROLLBACK");

    await submitHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "repayment_observed",
      source: "watcher",
      observedAt: "2026-06-15T22:10:00.000Z",
      createdAt: "2026-06-15T22:10:00.000Z",
      payload: { detail: "Full repayment.", watcherEventId: "watch-repay-full", repaymentVerifierStatus: "valid_full_repayment", repaymentAmount: record.repaymentAllocationPreview.totalDue },
    }, { lifecycleStore, eventStore, arbiterStore });

    const olderPartial = await submitHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "repayment_observed",
      source: "watcher",
      observedAt: "2026-06-15T22:05:00.000Z",
      createdAt: "2026-06-15T22:12:00.000Z",
      payload: { detail: "Older partial repayment.", watcherEventId: "watch-repay-partial-old", repaymentVerifierStatus: "valid_partial_repayment", repaymentAmount: 10 },
    }, { lifecycleStore, eventStore, arbiterStore });

    expect(olderPartial.data?.integrity.status).toBe("out_of_order");
    expect(olderPartial.data?.integrityReview.caseType).toBe("repayment_dispute");
    expect(arbiterStore.cases).toHaveLength(1);
    expect((await lifecycleStore.findByLookupCode(record.lookupCode))?.repaymentDetection.status).toBe("detected");
  });

  it("blocks older arbiter request from reopening resolved review", async () => {
    const { lifecycleStore, eventStore, arbiterStore, record } = setup("DCL-INTEGRITY-ARB-ORDER");

    await submitHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "arbiter_review_resolved",
      source: "arbiter",
      observedAt: "2026-06-15T22:10:00.000Z",
      createdAt: "2026-06-15T22:10:00.000Z",
      payload: { detail: "Resolved.", reviewId: "review-order-1", arbiterDecisionId: "arb-order-resolved" },
    }, { lifecycleStore, eventStore, arbiterStore });

    const olderRequest = await submitHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "arbiter_review_requested",
      source: "system",
      observedAt: "2026-06-15T22:05:00.000Z",
      createdAt: "2026-06-15T22:12:00.000Z",
      payload: { detail: "Older request.", reviewId: "review-order-1" },
    }, { lifecycleStore, eventStore, arbiterStore });

    expect(olderRequest.data?.integrity.status).toBe("out_of_order");
    expect(olderRequest.data?.integrityReview.caseType).toBe("manual_review");
    expect(arbiterStore.cases).toHaveLength(1);
    expect((await lifecycleStore.findByLookupCode(record.lookupCode))?.arbiterReview.status).toBe("resolved");
  });

  it("blocks liquidation review events that imply execution readiness", async () => {
    const { lifecycleStore, eventStore, arbiterStore, record } = setup("DCL-INTEGRITY-LIQ-UNSAFE");

    const unsafe = await submitHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "liquidation_review_confirmed",
      source: "oracle",
      observedAt: "2026-06-15T22:10:00.000Z",
      createdAt: "2026-06-15T22:10:00.000Z",
      payload: { detail: "Unsafe liquidation readiness.", health: "auto_liquidation_pending", automaticLiquidationBlocked: false, healthResultId: "health-unsafe-1" },
    }, { lifecycleStore, eventStore, arbiterStore });

    expect(unsafe.data?.integrity.status).toBe("unsafe_transition");
    expect(unsafe.data?.integrity.applied).toBe(false);
    expect(unsafe.data?.integrityReview).toMatchObject({
      recommended: true,
      action: "opened",
      caseType: "liquidation_health_review",
      borrowerSummary: "Loan health review open",
    });
    expect(arbiterStore.cases).toHaveLength(1);
    expect(arbiterStore.cases[0].safetyAuditNote).toContain("does not execute liquidation");
    expect((await lifecycleStore.findByLookupCode(record.lookupCode))?.liquidationHealth.status).toBe("healthy");
  });

  it("links repeated blocked events to the existing open case instead of duplicating it", async () => {
    const { lifecycleStore, eventStore, arbiterStore, record } = setup("DCL-INTEGRITY-LINK");

    await submitHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "collateral_lock_observed",
      source: "watcher",
      observedAt: "2026-06-15T22:10:00.000Z",
      createdAt: "2026-06-15T22:10:00.000Z",
      payload: { detail: "Collateral confirmed.", watcherEventId: "watch-link-new", collateralVerifierStatus: "confirmed" },
    }, { lifecycleStore, eventStore, arbiterStore });

    const firstBlocked = await submitHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "collateral_lock_observed",
      source: "watcher",
      observedAt: "2026-06-15T22:05:00.000Z",
      createdAt: "2026-06-15T22:12:00.000Z",
      payload: { detail: "Old stale collateral observation.", watcherEventId: "watch-link-old-1", watcherRiskStatus: "stale", collateralVerifierStatus: "stale" },
    }, { lifecycleStore, eventStore, arbiterStore });
    const secondBlocked = await submitHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "collateral_lock_observed",
      source: "watcher",
      observedAt: "2026-06-15T22:06:00.000Z",
      createdAt: "2026-06-15T22:13:00.000Z",
      payload: { detail: "Another old stale collateral observation.", watcherEventId: "watch-link-old-2", watcherRiskStatus: "stale", collateralVerifierStatus: "stale" },
    }, { lifecycleStore, eventStore, arbiterStore });

    expect(firstBlocked.data?.integrityReview.action).toBe("opened");
    expect(secondBlocked.data?.integrityReview.action).toBe("linked");
    expect(secondBlocked.data?.integrityReview.caseId).toBe(firstBlocked.data?.integrityReview.caseId);
    expect(arbiterStore.cases).toHaveLength(1);
    expect(arbiterStore.cases[0].relatedLifecycleEventIds).toEqual(expect.arrayContaining([
      firstBlocked.data?.event.id,
      secondBlocked.data?.event.id,
    ]));
  });

  it("keeps ops event history wired for integrity status rendering", async () => {
    const source = await readFile("src/components/lifecycle-event-history.tsx", "utf8");

    expect(source).toContain("integrityStatus");
    expect(source).toContain("integrityApplied");
    expect(source).toContain("integrityReason");
    expect(source).toContain("integrityReview");
    expect(source).toContain("Case id");
    expect(source).toContain("Borrower summary");
  });

  it("keeps borrower lookup copy simple and free of raw integrity failure labels", async () => {
    const source = await readFile("src/components/headless-borrower-lifecycle.tsx", "utf8");

    expect(source).not.toContain("unsafe_transition");
    expect(source).not.toContain("contradictory");
    expect(source).not.toContain("stale watcher");
    expect(source).not.toContain("replayed");
  });
});
