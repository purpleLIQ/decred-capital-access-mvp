import fs from "fs";
import path from "path";
import type {
  HeadlessLoanLifecycleRecord,
  LifecycleStatusSection,
  OptionalBorrowerContact,
} from "./headless-loan-lifecycle";

export type LifecycleStatusSectionKey =
  | "collateralLock"
  | "dcrPlatformFeeOutput"
  | "supplierDisbursement"
  | "repaymentDetection"
  | "collateralRelease"
  | "liquidationHealth"
  | "arbiterReview";

export interface HeadlessLifecycleStore {
  save(record: HeadlessLoanLifecycleRecord): Promise<HeadlessLoanLifecycleRecord>;
  findByLookupCode(lookupCode: string): Promise<HeadlessLoanLifecycleRecord | null>;
  listRecent(limit?: number): Promise<HeadlessLoanLifecycleRecord[]>;
  updateBorrowerContact(
    lookupCode: string,
    contact: OptionalBorrowerContact,
    updatedAt?: string,
  ): Promise<HeadlessLoanLifecycleRecord | null>;
  updateStatusSection(
    lookupCode: string,
    section: LifecycleStatusSectionKey,
    patch: Partial<LifecycleStatusSection<string>>,
    updatedAt?: string,
  ): Promise<HeadlessLoanLifecycleRecord | null>;
}

type StoreFile = {
  records: HeadlessLoanLifecycleRecord[];
};

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "headless-lifecycles.json");
let inMemoryRecords: HeadlessLoanLifecycleRecord[] | null = null;

export function createLocalHeadlessLifecycleStore(): HeadlessLifecycleStore {
  return {
    async save(record) {
      const records = loadRecords();
      const nextRecord = touchRecord(record, record.timestamps.lastUpdatedAt);
      const nextRecords = [nextRecord, ...records.filter((existing) => existing.lookupCode !== record.lookupCode)];
      persistRecords(nextRecords);
      return nextRecord;
    },

    async findByLookupCode(lookupCode) {
      const normalized = normalizeLookupCode(lookupCode);
      if (!normalized) return null;
      return loadRecords().find((record) => normalizeLookupCode(record.lookupCode) === normalized) ?? null;
    },

    async listRecent(limit = 10) {
      return loadRecords()
        .slice()
        .sort((a, b) => b.timestamps.lastUpdatedAt.localeCompare(a.timestamps.lastUpdatedAt))
        .slice(0, limit);
    },

    async updateBorrowerContact(lookupCode, contact, updatedAt = new Date().toISOString()) {
      return updateRecord(lookupCode, (record) => touchRecord({ ...record, borrowerContact: contact }, updatedAt));
    },

    async updateStatusSection(lookupCode, section, patch, updatedAt = new Date().toISOString()) {
      return updateRecord(lookupCode, (record) => applyStatusSectionPatch(record, section, patch, updatedAt));
    },
  };
}

export const headlessLifecycleStore = createLocalHeadlessLifecycleStore();

function updateRecord(
  lookupCode: string,
  updater: (record: HeadlessLoanLifecycleRecord) => HeadlessLoanLifecycleRecord,
): HeadlessLoanLifecycleRecord | null {
  const normalized = normalizeLookupCode(lookupCode);
  if (!normalized) return null;
  const records = loadRecords();
  const index = records.findIndex((record) => normalizeLookupCode(record.lookupCode) === normalized);
  if (index === -1) return null;

  const nextRecord = updater(records[index]);
  const nextRecords = [...records];
  nextRecords[index] = nextRecord;
  persistRecords(nextRecords);
  return nextRecord;
}

function applyStatusSectionPatch(
  record: HeadlessLoanLifecycleRecord,
  section: LifecycleStatusSectionKey,
  patch: Partial<LifecycleStatusSection<string>>,
  updatedAt: string,
): HeadlessLoanLifecycleRecord {
  const sectionPatch = { ...patch, updatedAt };

  switch (section) {
    case "collateralLock":
      return touchRecord({ ...record, collateralLock: { ...record.collateralLock, ...sectionPatch } }, updatedAt);
    case "dcrPlatformFeeOutput":
      return touchRecord({ ...record, dcrPlatformFeeOutput: { ...record.dcrPlatformFeeOutput, ...sectionPatch } }, updatedAt);
    case "supplierDisbursement":
      return touchRecord({ ...record, supplierDisbursement: { ...record.supplierDisbursement, ...sectionPatch } }, updatedAt);
    case "repaymentDetection":
      return touchRecord({ ...record, repaymentDetection: { ...record.repaymentDetection, ...sectionPatch } }, updatedAt);
    case "collateralRelease":
      return touchRecord({ ...record, collateralRelease: { ...record.collateralRelease, ...sectionPatch } }, updatedAt);
    case "liquidationHealth":
      return touchRecord({ ...record, liquidationHealth: { ...record.liquidationHealth, ...sectionPatch } }, updatedAt);
    case "arbiterReview":
      return touchRecord({ ...record, arbiterReview: { ...record.arbiterReview, ...sectionPatch } }, updatedAt);
  }
}

function touchRecord(record: HeadlessLoanLifecycleRecord, updatedAt: string): HeadlessLoanLifecycleRecord {
  return {
    ...record,
    timestamps: {
      ...record.timestamps,
      lastUpdatedAt: updatedAt,
    },
  };
}

function loadRecords(): HeadlessLoanLifecycleRecord[] {
  if (inMemoryRecords) return inMemoryRecords;
  fs.mkdirSync(dataDir, { recursive: true });

  if (!fs.existsSync(storePath)) {
    inMemoryRecords = [];
    persistRecords(inMemoryRecords);
    return inMemoryRecords;
  }

  const parsed = JSON.parse(fs.readFileSync(storePath, "utf8")) as StoreFile;
  inMemoryRecords = Array.isArray(parsed.records) ? parsed.records : [];
  return inMemoryRecords;
}

function persistRecords(records: HeadlessLoanLifecycleRecord[]): void {
  fs.mkdirSync(dataDir, { recursive: true });
  inMemoryRecords = records;
  fs.writeFileSync(storePath, JSON.stringify({ records }, null, 2));
}

function normalizeLookupCode(lookupCode: string): string {
  return lookupCode.trim().toUpperCase();
}
