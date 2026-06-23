import fs from "fs";
import path from "path";
import type { ArbiterActionDecision, ArbiterCaseStatus, ArbiterReviewCase } from "./arbiter-review-cases";

export interface ArbiterCaseStore {
  upsert(reviewCase: ArbiterReviewCase): Promise<ArbiterReviewCase>;
  findById(caseId: string): Promise<ArbiterReviewCase | null>;
  listOpen(limit?: number): Promise<ArbiterReviewCase[]>;
  listByLookupCode(lookupCode: string, limit?: number): Promise<ArbiterReviewCase[]>;
  updateStatus(caseId: string, status: ArbiterCaseStatus, updatedAt?: string): Promise<ArbiterReviewCase | null>;
  recordDecision(caseId: string, decision: ArbiterActionDecision): Promise<ArbiterReviewCase | null>;
}

type StoreFile = {
  cases: ArbiterReviewCase[];
};

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "arbiter-review-cases.json");
let memoryCases: ArbiterReviewCase[] | null = null;

export function createLocalArbiterCaseStore(): ArbiterCaseStore {
  return {
    async upsert(reviewCase) {
      const cases = loadCases();
      const existing = cases.find((item) => item.caseId === reviewCase.caseId);
      const nextCase = existing
        ? { ...existing, ...reviewCase, openedAt: existing.openedAt, decisions: reviewCase.decisions.length ? reviewCase.decisions : existing.decisions }
        : reviewCase;
      persistCases([nextCase, ...cases.filter((item) => item.caseId !== reviewCase.caseId)]);
      return nextCase;
    },

    async findById(caseId) {
      return loadCases().find((reviewCase) => reviewCase.caseId === caseId) ?? null;
    },

    async listOpen(limit = 25) {
      return loadCases()
        .filter((reviewCase) => !["resolved", "closed"].includes(reviewCase.status))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, limit);
    },

    async listByLookupCode(lookupCode, limit = 25) {
      const normalized = normalizeLookupCode(lookupCode);
      return loadCases()
        .filter((reviewCase) => normalizeLookupCode(reviewCase.lookupCode) === normalized)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, limit);
    },

    async updateStatus(caseId, status, updatedAt = new Date().toISOString()) {
      const cases = loadCases();
      const existing = cases.find((reviewCase) => reviewCase.caseId === caseId);
      if (!existing) return null;
      const nextCase = { ...existing, status, updatedAt };
      persistCases([nextCase, ...cases.filter((reviewCase) => reviewCase.caseId !== caseId)]);
      return nextCase;
    },

    async recordDecision(caseId, decision) {
      const cases = loadCases();
      const existing = cases.find((reviewCase) => reviewCase.caseId === caseId);
      if (!existing) return null;
      const nextCase = {
        ...existing,
        status: statusAfterDecision(decision.actionKind, decision.status, existing.status),
        updatedAt: decision.decidedAt,
        decisions: [decision, ...existing.decisions.filter((item) => item.decisionId !== decision.decisionId)],
      };
      persistCases([nextCase, ...cases.filter((reviewCase) => reviewCase.caseId !== caseId)]);
      return nextCase;
    },
  };
}

export const arbiterCaseStore = createLocalArbiterCaseStore();

function loadCases(): ArbiterReviewCase[] {
  if (memoryCases) return memoryCases;
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storePath)) {
    memoryCases = [];
    persistCases(memoryCases);
    return memoryCases;
  }
  const parsed = JSON.parse(fs.readFileSync(storePath, "utf8")) as StoreFile;
  memoryCases = Array.isArray(parsed.cases) ? parsed.cases : [];
  return memoryCases;
}

function persistCases(cases: ArbiterReviewCase[]): void {
  fs.mkdirSync(dataDir, { recursive: true });
  memoryCases = cases;
  fs.writeFileSync(storePath, JSON.stringify({ cases }, null, 2));
}

function normalizeLookupCode(lookupCode: string): string {
  return lookupCode.trim().toUpperCase();
}

function statusAfterDecision(actionKind: ArbiterActionDecision["actionKind"], decisionStatus: ArbiterActionDecision["status"], current: ArbiterCaseStatus): ArbiterCaseStatus {
  if (decisionStatus === "blocked") return "blocked";
  if (actionKind === "request_more_evidence") return "evidence_needed";
  if (actionKind === "mark_dispute") return "under_review";
  if (actionKind === "resolve_case") return "resolved";
  if (actionKind === "confirm_liquidation_review") return "action_required";
  if (actionKind === "recognize_repayment" || actionKind === "recognize_top_up" || actionKind === "pause_liquidation") return "under_review";
  return current;
}
