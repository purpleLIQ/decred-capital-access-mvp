import { describe, expect, it } from "vitest";

import { createHeadlessLoanLifecycleRecord, type HeadlessLoanLifecycleRecord, type OptionalBorrowerContact } from "../headless-loan-lifecycle";
import type { HeadlessLifecycleStore, LifecycleStatusSectionKey } from "../headless-lifecycle-store";
import type { LifecycleStatusSection } from "../headless-loan-lifecycle";
import { createHeadlessLifecycleEvent } from "../headless-lifecycle-events";
import { applyHeadlessLifecycleEvent } from "../headless-lifecycle-transitions";
import { submitHeadlessLifecycleEvent } from "../headless-lifecycle-event-api";
import type { HeadlessLifecycleEventStore } from "../lifecycle-event-store";
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
    publicLoanReference: "DCL-TIME-001",
    collateralDcr: 100,
    borrowAmount: 1000,
    borrowAsset: "USDC",
    borrowerAcceptedQuote: true,
  });
  void store.save(record);
  return { store, record };
}

describe("evidence timestamp transitions", () => {
  it("prepares timestamp metadata", async () => {
    const { store, record } = seededStore();
    const event = createHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "evidence_timestamp_prepared",
      source: "operator",
      observedAt: "2026-06-15T23:00:00.000Z",
      createdAt: "2026-06-15T23:00:00.000Z",
      payload: {
        detail: "Evidence hash prepared for timestamp anchoring.",
        evidenceHash: "abc123",
        digestAlgorithm: "sha256_placeholder",
        timestampProvider: "manual",
        publicSummaryId: "public-summary-1",
        timestampAuditNote: "Only hash metadata is stored; full evidence remains off-chain.",
      },
    });

    const result = await applyHeadlessLifecycleEvent(event, store);

    expect(result?.affectedSection).toBe("evidenceBundle");
    expect(result?.record.evidenceBundle.status).toBe("prepared");
    expect(result?.record.evidenceBundle.timestamp.status).toBe("prepared");
    expect(result?.record.evidenceBundle.timestamp.evidenceHash).toBe("abc123");
    expect(result?.record.evidenceBundle.timestamp.publicSummaryId).toBe("public-summary-1");
  });

  it("anchors and verifies evidence timestamps through the same event path", async () => {
    const { store, record } = seededStore();
    const eventStore = new MemoryEventStore();

    const anchored = await submitHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "evidence_timestamp_anchored",
      source: "watcher",
      observedAt: "2026-06-15T23:05:00.000Z",
      createdAt: "2026-06-15T23:05:00.000Z",
      payload: {
        detail: "Evidence timestamp anchor observed.",
        evidenceHash: "abc123",
        digestAlgorithm: "merkle_root",
        timestampProvider: "dcrtime",
        txid: "tx-time-1",
        merkleRoot: "merkle-root-1",
        chainTimestamp: "2026-06-15T23:04:30.000Z",
        verificationStatus: "pending",
      },
    }, { lifecycleStore: store, eventStore });

    const verified = await submitHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "evidence_timestamp_verified",
      source: "operator",
      observedAt: "2026-06-15T23:06:00.000Z",
      createdAt: "2026-06-15T23:06:00.000Z",
      payload: {
        detail: "Evidence timestamp verified against anchor metadata.",
        evidenceHash: "abc123",
        timestampProvider: "dcrtime",
        verificationStatus: "verified",
      },
    }, { lifecycleStore: store, eventStore });

    expect(anchored.data?.record.evidenceBundle.timestamp.status).toBe("anchored");
    expect(anchored.data?.record.evidenceBundle.timestamp.txid).toBe("tx-time-1");
    expect(anchored.data?.record.evidenceBundle.timestamp.merkleRoot).toBe("merkle-root-1");
    expect(verified.data?.record.evidenceBundle.timestamp.status).toBe("verified");
    expect(verified.data?.record.evidenceBundle.timestamp.verificationStatus).toBe("verified");
    expect(eventStore.events).toHaveLength(2);
  });

  it("records failed timestamp state as retryable metadata", async () => {
    const { store, record } = seededStore();
    const event = createHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "evidence_timestamp_failed",
      source: "operator",
      observedAt: "2026-06-15T23:10:00.000Z",
      createdAt: "2026-06-15T23:10:00.000Z",
      payload: {
        detail: "Timestamp provider unavailable; retry later.",
        evidenceHash: "abc123",
        timestampProvider: "dcrtime",
        verificationStatus: "failed",
      },
    });

    const result = await applyHeadlessLifecycleEvent(event, store);

    expect(result?.record.evidenceBundle.timestamp.status).toBe("failed");
    expect(result?.record.evidenceBundle.timestamp.verificationStatus).toBe("failed");
    expect(result?.record.evidenceBundle.detail).toContain("retry later");
  });
});
