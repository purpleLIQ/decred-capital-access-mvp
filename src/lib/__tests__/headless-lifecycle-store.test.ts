import { describe, expect, it } from "vitest";

import { createHeadlessLoanLifecycleRecord, type HeadlessLoanLifecycleRecord, type OptionalBorrowerContact } from "../headless-loan-lifecycle";
import { createAndSaveHeadlessLifecycle, listRecentHeadlessLifecycles, lookupHeadlessLifecycle, updateHeadlessLifecycleBorrowerContact } from "../headless-lifecycle-api";
import type { HeadlessLifecycleStore, LifecycleStatusSectionKey } from "../headless-lifecycle-store";

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

  async updateBorrowerContact(lookupCode: string, contact: OptionalBorrowerContact, updatedAt = "2026-06-15T21:30:00.000Z") {
    const record = await this.findByLookupCode(lookupCode);
    if (!record) return null;
    const nextRecord = { ...record, borrowerContact: contact, timestamps: { ...record.timestamps, lastUpdatedAt: updatedAt } };
    await this.save(nextRecord);
    return nextRecord;
  }

  async updateStatusSection(lookupCode: string, section: LifecycleStatusSectionKey, patch: Record<string, unknown>, updatedAt = "2026-06-15T21:30:00.000Z") {
    const record = await this.findByLookupCode(lookupCode);
    if (!record) return null;
    const nextRecord = {
      ...record,
      [section]: { ...(record[section] as Record<string, unknown>), ...patch, updatedAt },
      timestamps: { ...record.timestamps, lastUpdatedAt: updatedAt },
    } as HeadlessLoanLifecycleRecord;
    await this.save(nextRecord);
    return nextRecord;
  }
}

describe("headless lifecycle store API seam", () => {
  it("creates saves and looks up an accountless lifecycle record", async () => {
    const store = new MemoryLifecycleStore();
    const created = await createAndSaveHeadlessLifecycle({ collateralDcr: 100, borrowAmount: 1000, borrowAsset: "USDC" }, store);

    expect(created.ok).toBe(true);
    expect(created.data?.record.lookupCode).toContain("DCL-");

    const lookup = await lookupHeadlessLifecycle({ lookupCode: created.data?.record.lookupCode }, store);
    expect(lookup.data?.record?.publicLoanReference).toBe(created.data?.record.publicLoanReference);
  });

  it("lists recent records through the same store boundary", async () => {
    const store = new MemoryLifecycleStore();
    await store.save(createHeadlessLoanLifecycleRecord({ publicLoanReference: "DCL-A", collateralDcr: 100, borrowAmount: 1000, borrowAsset: "USDC", borrowerAcceptedQuote: true }));
    await store.save(createHeadlessLoanLifecycleRecord({ publicLoanReference: "DCL-B", collateralDcr: 100, borrowAmount: 900, borrowAsset: "USDC", borrowerAcceptedQuote: true }));

    const listed = await listRecentHeadlessLifecycles(1, store);
    expect(listed.data?.records).toHaveLength(1);
    expect(listed.data?.records[0].publicLoanReference).toBe("DCL-B");
  });

  it("updates optional contact without requiring borrower identity", async () => {
    const store = new MemoryLifecycleStore();
    const created = await createAndSaveHeadlessLifecycle({ collateralDcr: 100, borrowAmount: 1000, borrowAsset: "USDC" }, store);
    const lookupCode = created.data?.record.lookupCode ?? "";

    const updated = await updateHeadlessLifecycleBorrowerContact({
      lookupCode,
      borrowerContact: { preference: "email", value: "borrower-contact", consentForUpdates: true },
    }, store);

    expect(updated.ok).toBe(true);
    expect(updated.data?.record?.borrowerContact.value).toBe("borrower-contact");
    expect(updated.data?.record?.borrowerContact.note).toContain("not account creation");
  });
});
