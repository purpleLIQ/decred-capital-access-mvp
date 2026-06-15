import { describe, expect, it } from "vitest";

import { createHeadlessLoanLifecycleRecord, type HeadlessLoanLifecycleRecord, type OptionalBorrowerContact } from "../headless-loan-lifecycle";
import type { HeadlessLifecycleStore, LifecycleStatusSectionKey } from "../headless-lifecycle-store";
import { createHeadlessLifecycleEvent } from "../headless-lifecycle-events";
import { applyHeadlessLifecycleEvent } from "../headless-lifecycle-transitions";
import { submitHeadlessLifecycleEvent, listHeadlessLifecycleEvents } from "../headless-lifecycle-event-api";
import type { HeadlessLifecycleEventStore } from "../lifecycle-event-store";
import type { LifecycleStatusSection } from "../headless-loan-lifecycle";
import type { HeadlessLifecycleEvent } from "../headless-lifecycle-events";

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

function seededStore() {
  const store = new MemoryLifecycleStore();
  const record = createHeadlessLoanLifecycleRecord({
    publicLoanReference: "DCL-EVENT-001",
    collateralDcr: 100,
    borrowAmount: 1000,
    borrowAsset: "USDC",
    borrowerAcceptedQuote: true,
    repaymentAmount: 0,
  });
  void store.save(record);
  return { store, record };
}

describe("headless lifecycle events", () => {
  it("creates production-shaped lifecycle event ids and affected sections", async () => {
    const { store } = seededStore();
    const event = createHeadlessLifecycleEvent({
      lookupCode: "DCL-EVENT-001",
      kind: "collateral_lock_observed",
      source: "watcher",
      observedAt: "2026-06-15T22:00:00.000Z",
      createdAt: "2026-06-15T22:00:00.000Z",
      externalReference: "tx-lock-1",
      payload: { detail: "Collateral lock output observed.", txid: "tx-lock-1" },
    });

    const result = await applyHeadlessLifecycleEvent(event, store);

    expect(event.id).toContain("collateral_lock_observed");
    expect(result?.affectedSection).toBe("collateralLock");
    expect(result?.record.collateralLock.status).toBe("locked");
    expect(result?.record.lifecycleStatus).toBe("awaiting_supplier_disbursement");
    expect(result?.record.nextBorrowerAction).toContain("Wait for supplier disbursement");
  });

  it("updates repayment detection and marks collateral release ready after full repayment", async () => {
    const { store, record } = seededStore();
    const event = createHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "repayment_observed",
      source: "watcher",
      observedAt: "2026-06-15T22:05:00.000Z",
      createdAt: "2026-06-15T22:05:00.000Z",
      payload: { detail: "Repayment output observed.", repaymentAmount: record.repaymentAllocationPreview.totalDue, txid: "tx-repay-1" },
    });

    const result = await applyHeadlessLifecycleEvent(event, store);

    expect(result?.affectedSection).toBe("repaymentDetection");
    expect(result?.record.repaymentDetection.status).toBe("detected");
    expect(result?.record.collateralRelease.status).toBe("ready");
    expect(result?.record.nextBorrowerAction).toContain("collateral release");
  });

  it("submits an event through API seam, persists event, and returns updated record", async () => {
    const { store } = seededStore();
    const eventStore = new MemoryEventStore();

    const submitted = await submitHeadlessLifecycleEvent({
      lookupCode: "DCL-EVENT-001",
      kind: "supplier_disbursement_observed",
      source: "watcher",
      payload: { detail: "Supplier disbursement observed.", txid: "tx-disburse-1" },
      observedAt: "2026-06-15T22:10:00.000Z",
      createdAt: "2026-06-15T22:10:00.000Z",
    }, { lifecycleStore: store, eventStore });

    const listed = await listHeadlessLifecycleEvents({ lookupCode: "DCL-EVENT-001" }, eventStore);

    expect(submitted.ok).toBe(true);
    expect(submitted.data?.affectedSection).toBe("supplierDisbursement");
    expect(submitted.data?.record.supplierDisbursement.status).toBe("disbursed");
    expect(submitted.data?.record.lifecycleStatus).toBe("repayment_pending");
    expect(listed.data?.events).toHaveLength(1);
    expect(listed.data?.events[0].safetyAuditNote).toContain("No signing");
  });
});
