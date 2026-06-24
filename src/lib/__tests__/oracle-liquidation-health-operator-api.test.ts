import { describe, expect, it } from "vitest";

import type { ArbiterActionDecision, ArbiterCaseStatus, ArbiterReviewCase } from "../arbiter-review-cases";
import type { ArbiterCaseStore } from "../arbiter-case-store";
import type { HeadlessLifecycleEvent } from "../headless-lifecycle-events";
import { createHeadlessLoanLifecycleRecord, type HeadlessLoanLifecycleRecord, type LifecycleStatusSection, type OptionalBorrowerContact } from "../headless-loan-lifecycle";
import type { HeadlessLifecycleStore, LifecycleStatusSectionKey } from "../headless-lifecycle-store";
import type { HeadlessLifecycleEventStore } from "../lifecycle-event-store";
import { submitOperatorFixtureLiquidationHealthScenario } from "../oracle-liquidation-health-api";

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
    return this.cases.filter((reviewCase) => reviewCase.lookupCode.toUpperCase() === lookupCode.trim().toUpperCase()).slice(0, limit);
  }

  async updateStatus(caseId: string, status: ArbiterCaseStatus, updatedAt = "2026-06-24T12:00:00.000Z") {
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

function record() {
  return createHeadlessLoanLifecycleRecord({
    publicLoanReference: "DCL-OP-HEALTH-001",
    collateralDcr: 100,
    borrowAmount: 1_000,
    borrowAsset: "USDC",
    borrowerAcceptedQuote: true,
    repaymentAmount: 0,
  });
}

describe("operator liquidation-health fixture scenario API", () => {
  it("submits a fixture scenario for an existing stored lifecycle record", async () => {
    const lifecycleStore = new MemoryLifecycleStore();
    const eventStore = new MemoryEventStore();
    const arbiterStore = new MemoryArbiterCaseStore();
    const storedRecord = await lifecycleStore.save(record());

    const result = await submitOperatorFixtureLiquidationHealthScenario({
      lookupCode: storedRecord.lookupCode,
      scenario: "liquidation_eligible_state",
      now: "2026-06-24T12:30:00.000Z",
    }, { lifecycleStore, eventStore, arbiterStore });

    expect(result.ok).toBe(true);
    expect(result.data?.finalRecord.lookupCode).toBe(storedRecord.lookupCode);
    expect(result.data?.finalRecord.liquidationHealth.status).toBe("liquidation_eligible");
    expect(result.data?.healthResult.automaticLiquidationBlocked).toBe(true);
    expect(result.data?.submittedEvents.some((event) => event.kind === "liquidation_health_updated")).toBe(true);
    expect(result.data?.arbiterCases.some((reviewCase) => reviewCase.caseType === "liquidation_health_review")).toBe(true);
    expect(eventStore.events.some((event) => event.safetyAuditNote.includes("Automatic liquidation remains blocked"))).toBe(true);
  });

  it("returns not found instead of reconstructing from component-only state", async () => {
    const result = await submitOperatorFixtureLiquidationHealthScenario({
      lookupCode: "DCL-MISSING",
      scenario: "healthy_loan",
    }, { lifecycleStore: new MemoryLifecycleStore(), eventStore: new MemoryEventStore(), arbiterStore: new MemoryArbiterCaseStore() });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
  });

  it("keeps stale oracle and stale watcher scenarios blocked for review", async () => {
    for (const scenario of ["stale_oracle", "stale_watcher"] as const) {
      const lifecycleStore = new MemoryLifecycleStore();
      const eventStore = new MemoryEventStore();
      const arbiterStore = new MemoryArbiterCaseStore();
      const storedRecord = await lifecycleStore.save(record());

      const result = await submitOperatorFixtureLiquidationHealthScenario({
        lookupCode: storedRecord.lookupCode,
        scenario,
      }, { lifecycleStore, eventStore, arbiterStore });

      expect(result.data?.finalRecord.liquidationHealth.status).toBe("blocked");
      expect(result.data?.finalRecord.oracleHealth.oracleUsable).toBe(false);
      expect(result.data?.healthResult.automaticLiquidationBlocked).toBe(true);
      expect(result.data?.arbiterCases.length).toBeGreaterThan(0);
    }
  });
});
