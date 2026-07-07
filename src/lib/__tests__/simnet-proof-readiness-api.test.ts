import { describe, expect, it } from "vitest";

import type { ArbiterActionDecision, ArbiterCaseStatus, ArbiterReviewCase } from "../arbiter-review-cases";
import type { ArbiterCaseStore } from "../arbiter-case-store";
import { createHeadlessLoanLifecycleRecord, type HeadlessLoanLifecycleRecord, type LifecycleStatusSection, type OptionalBorrowerContact } from "../headless-loan-lifecycle";
import type { HeadlessLifecycleStore, LifecycleStatusSectionKey } from "../headless-lifecycle-store";
import type { HeadlessLifecycleEvent } from "../headless-lifecycle-events";
import type { HeadlessLifecycleEventStore } from "../lifecycle-event-store";
import { listSimnetProofSessions, refreshSimnetProofSession } from "../simnet-proof-readiness-api";
import type { SimnetProofSession } from "../simnet-proof-readiness";
import type { SimnetProofSessionStore } from "../simnet-proof-readiness-store";

describe("simnet proof readiness API helpers", () => {
  it("refreshes a review-only proof session from stored lifecycle state", async () => {
    const record = readyRecord();
    const sessionStore = new MemorySimnetProofSessionStore();
    const result = await refreshSimnetProofSession(
      { lookupCode: record.lookupCode, now: "2026-07-07T17:00:00.000Z" },
      {
        lifecycleStore: new MemoryLifecycleStore([record]),
        eventStore: new MemoryEventStore([]),
        arbiterStore: new MemoryArbiterCaseStore([]),
        sessionStore,
      },
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    expect(result.data?.session.status).toBe("broadcast_review_blocked");
    expect(result.data?.session.broadcastReviewStatus).toBe("blocked");
    expect(result.data?.safetyNote).toContain("No signing");

    const listed = await listSimnetProofSessions({ lookupCode: record.lookupCode }, sessionStore);
    expect(listed.data?.sessions).toHaveLength(1);
    expect(listed.data?.sessions[0].proofSessionId).toBe(result.data?.session.proofSessionId);
  });
});

function readyRecord(): HeadlessLoanLifecycleRecord {
  const now = "2026-07-07T16:00:00.000Z";
  const base = createHeadlessLoanLifecycleRecord({
    collateralDcr: 120,
    borrowAmount: 1000,
    borrowAsset: "USDC",
    borrowerAcceptedQuote: true,
    borrowerAcceptedPartialFunding: true,
    repaymentAmount: 1100,
    now,
  });

  return {
    ...base,
    collateralLock: { ...base.collateralLock, status: "locked", updatedAt: now },
    dcrPlatformFeeOutput: { ...base.dcrPlatformFeeOutput, status: "detected", updatedAt: now },
    repaymentDetection: { ...base.repaymentDetection, status: "detected", updatedAt: now },
    collateralRelease: { ...base.collateralRelease, status: "ready", updatedAt: now },
    arbiterReview: { ...base.arbiterReview, status: "resolved", updatedAt: now },
    evidenceBundle: {
      ...base.evidenceBundle,
      status: "prepared",
      updatedAt: now,
      timestamp: { ...base.evidenceBundle.timestamp, status: "verified", evidenceHash: "abc123", verificationStatus: "verified" },
    },
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
