import fs from "fs";
import path from "path";
import type { ArbiterActionDecision, ArbiterCaseStatus, ArbiterReviewCase } from "./arbiter-review";
import { buildAllowedArbiterActions } from "./arbiter-review";

export interface ArbiterReviewCaseStore {
  upsert(reviewCase: ArbiterReviewCase): Promise<ArbiterReviewCase>;
  findById(caseId: string): Promise<ArbiterReviewCase | null>;
  listOpen(limit?: number): Promise<ArbiterReviewCase[]>;
  listByLookupCode(lookupCode: string, limit?: number): Promise<ArbiterReviewCase[]>;
  updateStatus(caseId: string, status: ArbiterCaseStatus, note?: string, updatedAt?: string): Promise<ArbiterReviewCase | null>;
  recordDecision(caseId: string, decision: ArbiterActionDecision): Promise<ArbiterReviewCase | null>;
}

type StoreFile = { cases: ArbiterReviewCase[] };

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "arbiter-review-cases.json");
let memoryCases: ArbiterReviewCase[] | null = null;

export function createLocalArbiterReviewCaseStore(): ArbiterReviewCaseStore {
  return {
    async upsert(reviewCase) {
      const cases = loadCases();
      const nextCase = refreshActions({ ...reviewCase, updatedAt: reviewCase.updatedAt });
      const nextCases = [nextCase, ...cases.filter((existing) => existing.caseId !== reviewCase.caseId)];
      persistCases(nextCases);
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
      const normalized = lookupCode.trim().toUpperCase();
      return loadCases()
        .filter((reviewCase) => reviewCase.lookupCode.toUpperCase() === normalized)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, limit);
    },

    async updateStatus(caseId, status, note, updatedAt = new Date().toISOString()) {
      return updateCase(caseId, (reviewCase) => refreshActions({
        ...reviewCase,
        status,
        updatedAt,
        arbiterInternalSummary: note ? `${reviewCase.arbiterInternalSummary} Status note: ${note}` : reviewCase.arbiterInternalSummary,
      }));
    },

    async recordDecision(caseId, decision) {
      return updateCase(caseId, (reviewCase) => refreshActions({
        ...reviewCase,
        decisions: [decision, ...reviewCase.decisions.filter((existing) => existing.decisionId !== decision.decisionId)],
        status: decision.action === "resolve_case" || decision.action === "confirm_liquidation_review" ? "resolved" : decision.action === "request_more_evidence" ? "evidence_needed" : "under_review",
        updatedAt: decision.decidedAt,
      }));
    },
  };
}

export const arbiterReviewCaseStore = createLocalArbiterReviewCaseStore();

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

function updateCase(caseId: string, updater: (reviewCase: ArbiterReviewCase) => ArbiterReviewCase): ArbiterReviewCase | null {
  const cases = loadCases();
  const index = cases.findIndex((reviewCase) => reviewCase.caseId === caseId);
  if (index === -1) return null;
  const next = updater(cases[index]);
  const nextCases = [...cases];
  nextCases[index] = next;
  persistCases(nextCases);
  return next;
}

function refreshActions(reviewCase: ArbiterReviewCase): ArbiterReviewCase {
  return { ...reviewCase, allowedActions: buildAllowedArbiterActions(reviewCase) };
}
