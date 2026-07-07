import { describe, expect, it } from "vitest";

import type { ArbiterReviewCase } from "../arbiter-review-cases";
import { createHeadlessLoanLifecycleRecord, type HeadlessLoanLifecycleRecord } from "../headless-loan-lifecycle";
import { createFixtureSimnetProofSession, deriveSimnetProofReadiness } from "../simnet-proof-readiness";

describe("simnet proof readiness", () => {
  it("derives review-only readiness from a healthy lifecycle record", () => {
    const record = readyRecord();
    const readiness = deriveSimnetProofReadiness({ record });

    expect(readiness.status).toBe("broadcast_review_blocked");
    expect(readiness.collateralObservationStatus).toBe("ready");
    expect(readiness.platformFeeObservationStatus).toBe("ready");
    expect(readiness.evidenceBundleStatus).toBe("ready");
    expect(readiness.arbiterReviewStatus).toBe("ready");
    expect(readiness.unsignedReleasePreviewStatus).toBe("ready");
    expect(readiness.broadcastReviewStatus).toBe("blocked");
    expect(readiness.blockers).toContain("Broadcast blocked until a separate future simnet proof, signature verification, manual review, and explicit external broadcast process exist.");
  });

  it("blocks readiness when collateral is not locked", () => {
    const record = { ...readyRecord(), collateralLock: { ...readyRecord().collateralLock, status: "awaiting_borrower" as const } };
    const readiness = deriveSimnetProofReadiness({ record });

    expect(readiness.status).toBe("blocked");
    expect(readiness.collateralObservationStatus).toBe("blocked");
    expect(readiness.checklistItems.find((item) => item.id === "collateral_observed")?.status).toBe("blocked");
  });

  it("blocks readiness when the DCR platform fee output is missing", () => {
    const record = { ...readyRecord(), dcrPlatformFeeOutput: { ...readyRecord().dcrPlatformFeeOutput, status: "not_started" as const } };
    const readiness = deriveSimnetProofReadiness({ record });

    expect(readiness.status).toBe("blocked");
    expect(readiness.platformFeeObservationStatus).toBe("blocked");
    expect(readiness.nextSafeOperatorAction).toContain("platform fee");
  });

  it("blocks readiness when evidence is not prepared or timestamped", () => {
    const record = {
      ...readyRecord(),
      evidenceBundle: {
        ...readyRecord().evidenceBundle,
        status: "placeholder" as const,
        timestamp: { ...readyRecord().evidenceBundle.timestamp, status: "not_prepared" as const },
      },
    };
    const readiness = deriveSimnetProofReadiness({ record });

    expect(readiness.status).toBe("blocked");
    expect(readiness.evidenceBundleStatus).toBe("blocked");
    expect(readiness.nextSafeOperatorAction).toContain("evidence");
  });

  it("blocks readiness when an arbiter review case is unresolved", () => {
    const record = readyRecord();
    const readiness = deriveSimnetProofReadiness({ record, reviewCases: [reviewCase(record, "queued")] });

    expect(readiness.status).toBe("blocked");
    expect(readiness.arbiterReviewStatus).toBe("blocked");
    expect(readiness.checklistItems.find((item) => item.id === "review_ready")?.detail).toContain("unresolved review case");
  });

  it("creates a deterministic fixture session from a lifecycle record", () => {
    const session = createFixtureSimnetProofSession(readyRecord(), { now: "2026-07-07T16:30:00.000Z" });

    expect(session.proofSessionId).toBe("simnet-proof-dcl260707usdc1000");
    expect(session.lookupCode).toBe("DCL-260707-USDC-1000");
    expect(session.createdAt).toBe("2026-07-07T16:30:00.000Z");
    expect(session.status).toBe("broadcast_review_blocked");
  });

  it("never enables signing, broadcast, mainnet, or fund movement", () => {
    const session = createFixtureSimnetProofSession(readyRecord(), { now: "2026-07-07T16:30:00.000Z" });
    const serialized = JSON.stringify(session).toLowerCase();

    expect(session.signingSessionStatus).toBe("blocked");
    expect(session.signedHexSubmissionStatus).toBe("blocked");
    expect(session.signatureVerificationStatus).toBe("blocked");
    expect(session.broadcastReviewStatus).toBe("blocked");
    expect(serialized).toContain("no signing");
    expect(serialized).toContain("no broadcast");
    expect(serialized).toContain("no mainnet");
    expect(serialized).toContain("no fund movement");
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
    collateralLock: {
      ...base.collateralLock,
      status: "locked",
      detail: "Collateral lock confirmed by fixture watcher.",
      updatedAt: now,
    },
    dcrPlatformFeeOutput: {
      ...base.dcrPlatformFeeOutput,
      status: "detected",
      detail: "Platform fee output detected by fixture watcher.",
      updatedAt: now,
    },
    repaymentDetection: {
      ...base.repaymentDetection,
      status: "detected",
      detail: "Full repayment detected by fixture watcher.",
      updatedAt: now,
    },
    collateralRelease: {
      ...base.collateralRelease,
      status: "ready",
      detail: "Collateral release is ready for reviewed proof scaffolding.",
      updatedAt: now,
    },
    arbiterReview: {
      ...base.arbiterReview,
      status: "resolved",
      detail: "No open arbiter review blocks simnet proof readiness.",
      updatedAt: now,
    },
    evidenceBundle: {
      ...base.evidenceBundle,
      status: "prepared",
      detail: "Evidence bundle prepared for simnet proof readiness.",
      updatedAt: now,
      timestamp: {
        ...base.evidenceBundle.timestamp,
        status: "verified",
        evidenceHash: "abc123",
        verificationStatus: "verified",
      },
    },
  };
}

function reviewCase(record: HeadlessLoanLifecycleRecord, status: ArbiterReviewCase["status"]): ArbiterReviewCase {
  return {
    caseId: "arb-review-1",
    lookupCode: record.lookupCode,
    caseType: "manual_review",
    status,
    priority: "medium",
    reason: "Manual review remains open.",
    relatedLifecycleStatus: record.lifecycleStatus,
    relatedLifecycleEventIds: [],
    relatedWatcherEventIds: [],
    borrowerSafeSummary: "Review in progress.",
    arbiterInternalSummary: "Manual review remains open.",
    openedAt: "2026-07-07T16:00:00.000Z",
    updatedAt: "2026-07-07T16:00:00.000Z",
    allowedActions: [],
    decisions: [],
    safetyAuditNote: "Review-only.",
  };
}
