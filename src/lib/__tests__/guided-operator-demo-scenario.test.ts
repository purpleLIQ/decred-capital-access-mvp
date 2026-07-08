import { describe, expect, it } from "vitest";

import type { ArbiterActionDecision, ArbiterCaseStatus, ArbiterReviewCase } from "../arbiter-review-cases";
import type { ArbiterCaseStore } from "../arbiter-case-store";
import {
  createGuidedOperatorDemoPlan,
  runGuidedOperatorDemoAction,
} from "../guided-operator-demo-scenario";
import { createHeadlessLoanLifecycleRecord, type HeadlessLoanLifecycleRecord, type LifecycleStatusSection, type OptionalBorrowerContact } from "../headless-loan-lifecycle";
import type { HeadlessLifecycleStore, LifecycleStatusSectionKey } from "../headless-lifecycle-store";
import type { HeadlessLifecycleEvent } from "../headless-lifecycle-events";
import type { HeadlessLifecycleEventStore } from "../lifecycle-event-store";
import type { SimnetProofSession } from "../simnet-proof-readiness";
import type { SimnetProofSessionStore } from "../simnet-proof-readiness-store";

describe("guided operator demo scenario", () => {
  it("creates a plan from an existing lifecycle record", () => {
    const record = demoRecord();
    const plan = createGuidedOperatorDemoPlan(record);

    expect(plan.scenarioId).toBe("guided-demo-dcl260708usdc1000");
    expect(plan.scenarioName).toBe("Guided operator demo scenario");
    expect(plan.lookupCode).toBe(record.lookupCode);
    expect(plan.nextStepId).toBe("decred_collateral_fixture");
    expect(plan.steps.map((step) => step.id)).toEqual([
      "seed_or_select_record",
      "decred_collateral_fixture",
      "dcr_platform_fee_fixture",
      "borrow_asset_disbursement_fixture",
      "oracle_health_fixture",
      "evidence_timestamp_fixture",
      "arbiter_review_visibility",
      "simnet_proof_readiness",
    ]);
  });

  it("sequences the next safe fixture step from lifecycle state", async () => {
    const stores = createStores(demoRecord());

    const collateral = await runGuidedOperatorDemoAction({ lookupCode: demoRecord().lookupCode, action: "run_next", now: "2026-07-08T14:00:00.000Z" }, stores);
    expect(collateral.ok).toBe(true);
    expect(collateral.data?.submittedEvents.map((event) => event.kind)).toEqual(["collateral_lock_observed"]);
    expect(collateral.data?.scenario.nextStepId).toBe("dcr_platform_fee_fixture");

    const fee = await runGuidedOperatorDemoAction({ lookupCode: demoRecord().lookupCode, action: "run_next", now: "2026-07-08T14:00:00.000Z" }, stores);
    expect(fee.data?.submittedEvents.map((event) => event.kind)).toEqual(["dcr_platform_fee_output_observed"]);
    expect(fee.data?.scenario.nextStepId).toBe("borrow_asset_disbursement_fixture");
  });

  it("runs the coherent review-only scenario through existing lifecycle, oracle, review, and proof seams", async () => {
    const stores = createStores(demoRecord());
    const result = await runGuidedOperatorDemoAction({ lookupCode: demoRecord().lookupCode, action: "run_all", now: "2026-07-08T14:00:00.000Z" }, stores);

    expect(result.ok).toBe(true);
    expect(result.data?.record.collateralLock.status).toBe("locked");
    expect(result.data?.record.dcrPlatformFeeOutput.status).toBe("detected");
    expect(result.data?.record.supplierDisbursement.status).toBe("disbursed");
    expect(result.data?.record.evidenceBundle.timestamp.status).toBe("verified");
    expect(result.data?.submittedEvents.some((event) => event.kind === "liquidation_health_updated")).toBe(true);
    expect(result.data?.arbiterCases.length).toBeGreaterThan(0);
    expect(result.data?.scenario.arbiterCaseIds.length).toBeGreaterThan(0);
    expect(result.data?.scenario.simnetProofSessionId).toMatch(/^simnet-proof-/);
    expect(result.data?.proofSession?.broadcastReviewStatus).toBe("blocked");
    expect(result.data?.safetyNote).toContain("No live Decred");
    expect(result.data?.safetyNote).toContain("No signing");
  });

  it("keeps duplicate scenario runs idempotent under existing event and case gates", async () => {
    const stores = createStores(demoRecord());
    const first = await runGuidedOperatorDemoAction({ lookupCode: demoRecord().lookupCode, action: "run_all", now: "2026-07-08T14:00:00.000Z" }, stores);
    const second = await runGuidedOperatorDemoAction({ lookupCode: demoRecord().lookupCode, action: "run_all", now: "2026-07-08T14:00:00.000Z" }, stores);
    const events = await stores.eventStore.listByLookupCode(demoRecord().lookupCode, 100);
    const cases = await stores.arbiterStore.listByLookupCode(demoRecord().lookupCode, 100);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
    expect(new Set(cases.map((reviewCase) => reviewCase.caseId)).size).toBe(cases.length);
    expect(second.data?.scenario.simnetProofSessionId).toBe(first.data?.scenario.simnetProofSessionId);
  });

  it("derives borrower-safe copy without raw watcher oracle integrity internals", async () => {
    const stores = createStores(demoRecord());
    const result = await runGuidedOperatorDemoAction({ lookupCode: demoRecord().lookupCode, action: "run_all", now: "2026-07-08T14:00:00.000Z" }, stores);
    const status = result.data?.scenario.borrowerSafeStatus ?? "";
    const serialized = JSON.stringify({ status }).toLowerCase();

    expect(["Loan setup in progress", "Collateral review in progress", "Repayment review in progress", "Loan health review in progress", "Proof readiness review in progress"]).toContain(status);
    expect(serialized).not.toContain("watcher");
    expect(serialized).not.toContain("oracle");
    expect(serialized).not.toContain("integrity");
    expect(serialized).not.toContain("simnet");
  });

  it("never enables signing, broadcast, mainnet, or fund movement", async () => {
    const stores = createStores(demoRecord());
    const result = await runGuidedOperatorDemoAction({ lookupCode: demoRecord().lookupCode, action: "run_all", now: "2026-07-08T14:00:00.000Z" }, stores);
    const text = JSON.stringify(result.data?.scenario).toLowerCase();

    expect(result.data?.scenario.safetyNotes.join(" ")).toContain("Broadcast blocked");
    expect(text).toContain("no signing");
    expect(text).toContain("no broadcast");
    expect(text).toContain("no real funds");
  });
});

function demoRecord(): HeadlessLoanLifecycleRecord {
  return createHeadlessLoanLifecycleRecord({
    collateralDcr: 120,
    borrowAmount: 1000,
    borrowAsset: "USDC",
    borrowerAcceptedQuote: true,
    borrowerAcceptedPartialFunding: true,
    repaymentAmount: 0,
    requestedAmountUsd: 1000,
    now: "2026-07-08T13:45:00.000Z",
  });
}

function createStores(record: HeadlessLoanLifecycleRecord) {
  return {
    lifecycleStore: new MemoryLifecycleStore([record]),
    eventStore: new MemoryEventStore([]),
    arbiterStore: new MemoryArbiterCaseStore([]),
    sessionStore: new MemorySimnetProofSessionStore(),
  };
}

class MemoryLifecycleStore implements HeadlessLifecycleStore {
  constructor(private records: HeadlessLoanLifecycleRecord[]) {}

  async save(record: HeadlessLoanLifecycleRecord): Promise<HeadlessLoanLifecycleRecord> {
    this.records = [record, ...this.records.filter((item) => item.lookupCode !== record.lookupCode)];
    return record;
  }

  async findByLookupCode(lookupCode: string): Promise<HeadlessLoanLifecycleRecord | null> {
    return this.records.find((record) => record.lookupCode === lookupCode) ?? null;
  }

  async listRecent(limit = 10): Promise<HeadlessLoanLifecycleRecord[]> {
    return this.records.slice(0, limit);
  }

  async updateBorrowerContact(lookupCode: string, contact: OptionalBorrowerContact): Promise<HeadlessLoanLifecycleRecord | null> {
    const record = await this.findByLookupCode(lookupCode);
    if (!record) return null;
    const next = { ...record, borrowerContact: contact };
    await this.save(next);
    return next;
  }

  async updateStatusSection(
    lookupCode: string,
    section: LifecycleStatusSectionKey,
    patch: Partial<LifecycleStatusSection<string>>,
  ): Promise<HeadlessLoanLifecycleRecord | null> {
    const record = await this.findByLookupCode(lookupCode);
    if (!record) return null;
    const next = { ...record, [section]: { ...record[section], ...patch } } as HeadlessLoanLifecycleRecord;
    await this.save(next);
    return next;
  }
}

class MemoryEventStore implements HeadlessLifecycleEventStore {
  constructor(private events: HeadlessLifecycleEvent[]) {}

  async save(event: HeadlessLifecycleEvent): Promise<HeadlessLifecycleEvent> {
    this.events = [event, ...this.events.filter((item) => item.id !== event.id)];
    return event;
  }

  async findByEventId(eventId: string): Promise<HeadlessLifecycleEvent | null> {
    return this.events.find((event) => event.id === eventId) ?? null;
  }

  async findByExternalReference(lookupCode: string, externalReference: string): Promise<HeadlessLifecycleEvent | null> {
    return this.events.find((event) => event.lookupCode === lookupCode && event.externalReference === externalReference) ?? null;
  }

  async findByWatcherEventId(lookupCode: string, watcherEventId: string): Promise<HeadlessLifecycleEvent | null> {
    return this.events.find((event) => event.lookupCode === lookupCode && event.payload.watcherEventId === watcherEventId) ?? null;
  }

  async findByHealthResultId(lookupCode: string, healthResultId: string): Promise<HeadlessLifecycleEvent | null> {
    return this.events.find((event) => event.lookupCode === lookupCode && event.payload.healthResultId === healthResultId) ?? null;
  }

  async findByArbiterDecisionId(lookupCode: string, arbiterDecisionId: string): Promise<HeadlessLifecycleEvent | null> {
    return this.events.find((event) => event.lookupCode === lookupCode && event.payload.arbiterDecisionId === arbiterDecisionId) ?? null;
  }

  async listByLookupCode(lookupCode: string, limit = 20): Promise<HeadlessLifecycleEvent[]> {
    return this.events.filter((event) => event.lookupCode === lookupCode).slice(0, limit);
  }

  async listRecent(limit = 25): Promise<HeadlessLifecycleEvent[]> {
    return this.events.slice(0, limit);
  }
}

class MemoryArbiterCaseStore implements ArbiterCaseStore {
  constructor(private cases: ArbiterReviewCase[]) {}

  async upsert(reviewCase: ArbiterReviewCase): Promise<ArbiterReviewCase> {
    this.cases = [reviewCase, ...this.cases.filter((item) => item.caseId !== reviewCase.caseId)];
    return reviewCase;
  }

  async findById(caseId: string): Promise<ArbiterReviewCase | null> {
    return this.cases.find((item) => item.caseId === caseId) ?? null;
  }

  async listOpen(limit = 25): Promise<ArbiterReviewCase[]> {
    return this.cases.filter((item) => !["resolved", "closed"].includes(item.status)).slice(0, limit);
  }

  async listByLookupCode(lookupCode: string, limit = 25): Promise<ArbiterReviewCase[]> {
    return this.cases.filter((item) => item.lookupCode === lookupCode).slice(0, limit);
  }

  async updateStatus(caseId: string, status: ArbiterCaseStatus): Promise<ArbiterReviewCase | null> {
    const existing = await this.findById(caseId);
    if (!existing) return null;
    const next = { ...existing, status };
    await this.upsert(next);
    return next;
  }

  async recordDecision(caseId: string, decision: ArbiterActionDecision): Promise<ArbiterReviewCase | null> {
    const existing = await this.findById(caseId);
    if (!existing) return null;
    const next = { ...existing, decisions: [decision, ...existing.decisions] };
    await this.upsert(next);
    return next;
  }
}

class MemorySimnetProofSessionStore implements SimnetProofSessionStore {
  private sessions: SimnetProofSession[] = [];

  async upsert(session: SimnetProofSession): Promise<SimnetProofSession> {
    this.sessions = [session, ...this.sessions.filter((item) => item.proofSessionId !== session.proofSessionId)];
    return session;
  }

  async findById(proofSessionId: string): Promise<SimnetProofSession | null> {
    return this.sessions.find((session) => session.proofSessionId === proofSessionId) ?? null;
  }

  async listByLookupCode(lookupCode: string, limit = 10): Promise<SimnetProofSession[]> {
    return this.sessions.filter((session) => session.lookupCode === lookupCode).slice(0, limit);
  }

  async listRecent(limit = 10): Promise<SimnetProofSession[]> {
    return this.sessions.slice(0, limit);
  }
}
