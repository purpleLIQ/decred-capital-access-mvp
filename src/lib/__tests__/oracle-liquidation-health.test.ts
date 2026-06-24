import { describe, expect, it } from "vitest";

import type { ArbiterActionDecision, ArbiterCaseStatus, ArbiterReviewCase } from "../arbiter-review-cases";
import type { ArbiterCaseStore } from "../arbiter-case-store";
import type { HeadlessLifecycleEvent } from "../headless-lifecycle-events";
import { createHeadlessLoanLifecycleRecord, type HeadlessLoanLifecycleRecord, type LifecycleStatusSection, type OptionalBorrowerContact } from "../headless-loan-lifecycle";
import type { HeadlessLifecycleStore, LifecycleStatusSectionKey } from "../headless-lifecycle-store";
import type { HeadlessLifecycleEventStore } from "../lifecycle-event-store";
import { buildOraclePolicyInput, createOraclePriceObservation } from "../oracle-liquidation-health";
import {
  createFixtureLiquidationHealthScenario,
  submitFixtureLiquidationHealthScenario,
  type LiquidationHealthFixtureScenarioName,
} from "../oracle-liquidation-health-fixtures";

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

function seededRecord(publicLoanReference = "DCL-HEALTH-001") {
  return createHeadlessLoanLifecycleRecord({
    publicLoanReference,
    collateralDcr: 100,
    borrowAmount: 1_000,
    borrowAsset: "USDC",
    borrowerAcceptedQuote: true,
    repaymentAmount: 0,
  });
}

function stores() {
  return {
    lifecycleStore: new MemoryLifecycleStore(),
    eventStore: new MemoryEventStore(),
    arbiterStore: new MemoryArbiterCaseStore(),
  };
}

describe("oracle liquidation health policy", () => {
  it("builds usable oracle policy input from fresh quorum observations", () => {
    const now = "2026-06-24T12:00:00.000Z";
    const input = buildOraclePolicyInput({
      borrowAsset: "USDC",
      now,
      observations: [
        createOraclePriceObservation({ observationId: "dcr-a", observedAt: now, assetPair: "DCR/USD", price: 30 }),
        createOraclePriceObservation({ observationId: "dcr-b", observedAt: now, assetPair: "DCR/USD", price: 30.2 }),
        createOraclePriceObservation({ observationId: "usdc-a", observedAt: now, assetPair: "USDC/USD", price: 1 }),
        createOraclePriceObservation({ observationId: "usdc-b", observedAt: now, assetPair: "USDC/USD", price: 1 }),
      ],
    });

    expect(input.usable).toBe(true);
    expect(input.freshnessStatus).toBe("fresh");
    expect(input.deviationStatus).toBe("fresh");
    expect(input.quorumStatus).toBe("fresh");
    expect(input.selectedObservationIds).toHaveLength(4);
  });

  it.each([
    ["healthy_loan", "healthy"],
    ["warning_state", "warning"],
    ["borrower_warning_opened", "warning"],
    ["margin_call_state", "margin_call"],
    ["top_up_requested", "margin_call"],
    ["liquidation_eligible_state", "liquidation_eligible"],
    ["arbiter_review_case_opened", "liquidation_eligible"],
    ["stale_oracle", "blocked"],
    ["deviated_oracle", "blocked"],
    ["stale_watcher", "blocked"],
  ] satisfies [LiquidationHealthFixtureScenarioName, HeadlessLoanLifecycleRecord["liquidationHealth"]["status"]][])("maps %s to %s", (scenario, expectedStatus) => {
    const fixture = createFixtureLiquidationHealthScenario({ scenario, record: seededRecord(`DCL-${scenario}`) });

    expect(fixture.healthResult.status).toBe(expectedStatus);
    expect(fixture.healthResult.automaticLiquidationBlocked).toBe(true);
    expect(fixture.lifecycleEvents.some((event) => event.kind === "liquidation_health_updated")).toBe(true);
  });

  it("submits healthy fixture events through the lifecycle API and preserves usable oracle output", async () => {
    const memoryStores = stores();
    const submitted = await submitFixtureLiquidationHealthScenario({
      scenario: "healthy_loan",
      record: seededRecord("DCL-HEALTH-OK"),
      stores: memoryStores,
    });

    expect(submitted.finalRecord.liquidationHealth.status).toBe("healthy");
    expect(submitted.finalRecord.oracleHealth.oracleUsable).toBe(true);
    expect(submitted.finalRecord.oracleHealth.selectedDcrUsdPrice).toBe(30);
    expect(submitted.arbiterCases).toHaveLength(0);
    expect(memoryStores.eventStore.events.some((event) => event.kind === "oracle_price_observed")).toBe(true);
  });

  it("opens borrower warning and top-up windows without executing liquidation", async () => {
    const warningStores = stores();
    const topUpStores = stores();

    const warning = await submitFixtureLiquidationHealthScenario({
      scenario: "borrower_warning_opened",
      record: seededRecord("DCL-HEALTH-WARN"),
      stores: warningStores,
    });
    const topUp = await submitFixtureLiquidationHealthScenario({
      scenario: "top_up_requested",
      record: seededRecord("DCL-HEALTH-TOPUP"),
      stores: topUpStores,
    });

    expect(warning.finalRecord.liquidationHealth.status).toBe("warning");
    expect(warning.finalRecord.borrowerWarningWindow.status).toBe("warning_open");
    expect(warning.finalRecord.borrowerWarningWindow.topUpRequested).toBe(false);
    expect(topUp.finalRecord.liquidationHealth.status).toBe("margin_call");
    expect(topUp.finalRecord.borrowerWarningWindow.status).toBe("top_up_requested");
    expect(topUp.finalRecord.borrowerWarningWindow.topUpRequested).toBe(true);
    expect(topUp.finalRecord.oracleHealth.automaticLiquidationBlocked).toBe(true);
    expect(topUp.submittedEvents.some((event) => event.kind === "top_up_requested")).toBe(true);
  });

  it("opens arbiter review cases for liquidation eligibility and keeps execution blocked", async () => {
    const memoryStores = stores();
    const submitted = await submitFixtureLiquidationHealthScenario({
      scenario: "arbiter_review_case_opened",
      record: seededRecord("DCL-HEALTH-ARB"),
      stores: memoryStores,
    });

    expect(submitted.finalRecord.liquidationHealth.status).toBe("liquidation_eligible");
    expect(submitted.finalRecord.arbiterReview.status).toBe("requested");
    expect(submitted.arbiterCases.some((reviewCase) => reviewCase.caseType === "liquidation_health_review")).toBe(true);
    expect(submitted.arbiterCases.every((reviewCase) => reviewCase.safetyAuditNote.includes("does not execute liquidation"))).toBe(true);
    expect(submitted.healthResult.automaticLiquidationBlocked).toBe(true);
    expect(submitted.arbiterLifecycleEvents.some((event) => event.kind === "arbiter_review_requested")).toBe(true);
  });

  it("blocks stale/deviated oracle and watcher scenarios for review instead of liquidation", async () => {
    for (const scenario of ["stale_oracle", "deviated_oracle", "stale_watcher"] satisfies LiquidationHealthFixtureScenarioName[]) {
      const memoryStores = stores();
      const submitted = await submitFixtureLiquidationHealthScenario({
        scenario,
        record: seededRecord(`DCL-${scenario}-BLOCK`),
        stores: memoryStores,
      });

      expect(submitted.finalRecord.liquidationHealth.status).toBe("blocked");
      expect(submitted.finalRecord.oracleHealth.oracleUsable).toBe(false);
      expect(submitted.finalRecord.oracleHealth.blockerReason).toBeTruthy();
      expect(submitted.arbiterCases.length).toBeGreaterThan(0);
      expect(submitted.healthResult.automaticLiquidationBlocked).toBe(true);
    }
  });

  it("produces a privacy-safe evidence summary for handoff and timestamping", () => {
    const fixture = createFixtureLiquidationHealthScenario({
      scenario: "evidence_summary_prepared",
      record: seededRecord("DCL-HEALTH-EVIDENCE"),
    });

    expect(fixture.evidenceSummary.lookupCode).toBe("DCL-HEALTH-EVIDENCE");
    expect(fixture.evidenceSummary.oracleObservationIds).toHaveLength(4);
    expect(fixture.evidenceSummary.thresholds.liquidationEligibleLtvBps).toBeGreaterThan(0);
    expect(fixture.evidenceSummary.safetyAuditNote).toContain("excludes borrower contact");
    expect(JSON.stringify(fixture.evidenceSummary)).not.toContain("borrower@example.com");
  });
});
