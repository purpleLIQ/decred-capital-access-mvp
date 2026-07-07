import type { ArbiterReviewCase } from "./arbiter-review-cases";
import type { HeadlessLifecycleEvent } from "./headless-lifecycle-events";
import type { HeadlessLoanLifecycleRecord } from "./headless-loan-lifecycle";

export type SimnetProofReadinessStatus =
  | "not_started"
  | "record_found"
  | "collateral_observed"
  | "fee_output_observed"
  | "evidence_ready"
  | "review_ready"
  | "unsigned_release_preview_ready"
  | "signing_session_requested"
  | "signed_hex_submitted"
  | "signature_verification_pending"
  | "signature_verified"
  | "broadcast_review_blocked"
  | "blocked";

export type SimnetProofGateStatus = "not_started" | "ready" | "blocked";
export type SimnetProofChecklistStatus = "ready" | "blocked" | "pending";

export interface SimnetProofChecklistItem {
  id: string;
  label: string;
  status: SimnetProofChecklistStatus;
  detail: string;
  safetyNote?: string;
}

export interface SimnetProofReadinessSummary {
  status: SimnetProofReadinessStatus;
  checklistItems: SimnetProofChecklistItem[];
  blockers: string[];
  nextSafeOperatorAction: string;
  collateralObservationStatus: SimnetProofGateStatus;
  platformFeeObservationStatus: SimnetProofGateStatus;
  evidenceBundleStatus: SimnetProofGateStatus;
  arbiterReviewStatus: SimnetProofGateStatus;
  releasePreconditionStatus: SimnetProofGateStatus;
  unsignedReleasePreviewStatus: SimnetProofGateStatus;
  signingSessionStatus: SimnetProofGateStatus;
  signedHexSubmissionStatus: SimnetProofGateStatus;
  signatureVerificationStatus: SimnetProofGateStatus;
  broadcastReviewStatus: "blocked";
  safetyNotes: string[];
}

export interface SimnetProofSession extends SimnetProofReadinessSummary {
  proofSessionId: string;
  lookupCode: string;
  publicLoanReference: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeriveSimnetProofReadinessInput {
  record: HeadlessLoanLifecycleRecord;
  recentEvents?: HeadlessLifecycleEvent[];
  reviewCases?: ArbiterReviewCase[];
}

export interface CreateFixtureSimnetProofSessionOptions {
  recentEvents?: HeadlessLifecycleEvent[];
  reviewCases?: ArbiterReviewCase[];
  now?: string;
}

const REVIEW_ONLY_SAFETY_NOTE = "Review-only simnet proof scaffold. No signing, no broadcast, no mainnet, no real transactions, no collateral release execution, no liquidation execution, and no fund movement.";
const BROADCAST_BLOCKED_NOTE = "Broadcast blocked until a separate future simnet proof, signature verification, manual review, and explicit external broadcast process exist.";

export function deriveSimnetProofReadiness(input: DeriveSimnetProofReadinessInput): SimnetProofReadinessSummary {
  const { record } = input;
  const recentEvents = input.recentEvents ?? [];
  const reviewCases = input.reviewCases ?? [];
  const unresolvedReviewCases = reviewCases.filter((reviewCase) => !["resolved", "closed"].includes(reviewCase.status));

  const collateralReady = record.collateralLock.status === "locked" && !hasBadCollateralEvent(recentEvents);
  const platformFeeReady = ["detected", "routed"].includes(record.dcrPlatformFeeOutput.status) && !hasBadPlatformFeeEvent(recentEvents);
  const evidenceReady = isEvidenceReady(record) && !hasBlockedIntegrityReviewEvent(recentEvents, "evidence");
  const reviewReady = record.arbiterReview.status !== "requested" && unresolvedReviewCases.length === 0 && !hasBlockedIntegrityReviewEvent(recentEvents, "review");
  const releaseReady = record.repaymentDetection.status === "detected" || ["ready", "released"].includes(record.collateralRelease.status);

  const blockers = [
    collateralReady ? null : "Collateral lock has not been confirmed by the safe lifecycle record.",
    platformFeeReady ? null : "DCR platform fee output has not been detected by the safe lifecycle record.",
    evidenceReady ? null : "Evidence bundle or timestamp proof is not ready for simnet review.",
    reviewReady ? null : "Arbiter/manual review is unresolved or blocked.",
    releaseReady ? null : "Repayment or collateral-release precondition is not ready for a release proof preview.",
    BROADCAST_BLOCKED_NOTE,
  ].filter(Boolean) as string[];

  const preconditionsReady = collateralReady && platformFeeReady && evidenceReady && reviewReady && releaseReady;
  const status = resolveReadinessStatus({
    collateralReady,
    platformFeeReady,
    evidenceReady,
    reviewReady,
    releaseReady,
  });

  const unsignedReleasePreviewStatus: SimnetProofGateStatus = preconditionsReady ? "ready" : "blocked";

  return {
    status,
    checklistItems: [
      {
        id: "record_found",
        label: "Lifecycle record found",
        status: "ready",
        detail: `${record.publicLoanReference} is available through the existing lifecycle store.`,
      },
      {
        id: "collateral_observed",
        label: "Collateral observed",
        status: collateralReady ? "ready" : "blocked",
        detail: collateralReady ? "Collateral lock is marked locked." : record.collateralLock.detail,
      },
      {
        id: "platform_fee_observed",
        label: "Platform fee output observed",
        status: platformFeeReady ? "ready" : "blocked",
        detail: platformFeeReady ? "DCR platform fee output is detected or routed." : record.dcrPlatformFeeOutput.detail,
      },
      {
        id: "evidence_ready",
        label: "Evidence bundle ready",
        status: evidenceReady ? "ready" : "blocked",
        detail: evidenceReady ? "Evidence bundle or timestamp metadata is prepared for review." : record.evidenceBundle.detail,
      },
      {
        id: "review_ready",
        label: "Arbiter review clear",
        status: reviewReady ? "ready" : "blocked",
        detail: reviewReady ? "No unresolved arbiter/manual review case blocks the session." : reviewBlockerDetail(record, unresolvedReviewCases),
      },
      {
        id: "release_precondition_ready",
        label: "Release precondition ready",
        status: releaseReady ? "ready" : "blocked",
        detail: releaseReady ? "Repayment is detected or collateral release is marked ready." : record.collateralRelease.detail,
      },
      {
        id: "unsigned_release_preview",
        label: "Unsigned release preview placeholder",
        status: unsignedReleasePreviewStatus === "ready" ? "ready" : "blocked",
        detail: unsignedReleasePreviewStatus === "ready"
          ? "A future unsigned release preview could be prepared outside this scaffold."
          : "Unsigned release preview placeholder remains blocked until every readiness item is ready.",
        safetyNote: "No transaction hex, PSBT, wallet command, or real release transaction is generated.",
      },
      {
        id: "signing_session",
        label: "Signing session placeholder",
        status: "blocked",
        detail: "Signing session remains blocked in this milestone.",
        safetyNote: "The app does not request signatures or handle private keys.",
      },
      {
        id: "signed_hex_submission",
        label: "External signed-hex placeholder",
        status: "blocked",
        detail: "External signed-hex submission remains blocked in this milestone.",
        safetyNote: "The app does not accept or relay signed transaction hex for broadcast.",
      },
      {
        id: "signature_verification",
        label: "Signature verification placeholder",
        status: "blocked",
        detail: "Signature verification remains a future placeholder.",
        safetyNote: "No signature verification result can enable broadcast.",
      },
      {
        id: "broadcast_review",
        label: "Broadcast review",
        status: "blocked",
        detail: "Broadcast blocked.",
        safetyNote: BROADCAST_BLOCKED_NOTE,
      },
    ],
    blockers,
    nextSafeOperatorAction: resolveNextSafeOperatorAction({
      collateralReady,
      platformFeeReady,
      evidenceReady,
      reviewReady,
      releaseReady,
      unsignedReleasePreviewStatus,
    }),
    collateralObservationStatus: collateralReady ? "ready" : "blocked",
    platformFeeObservationStatus: platformFeeReady ? "ready" : "blocked",
    evidenceBundleStatus: evidenceReady ? "ready" : "blocked",
    arbiterReviewStatus: reviewReady ? "ready" : "blocked",
    releasePreconditionStatus: releaseReady ? "ready" : "blocked",
    unsignedReleasePreviewStatus,
    signingSessionStatus: "blocked",
    signedHexSubmissionStatus: "blocked",
    signatureVerificationStatus: "blocked",
    broadcastReviewStatus: "blocked",
    safetyNotes: [REVIEW_ONLY_SAFETY_NOTE, BROADCAST_BLOCKED_NOTE],
  };
}

export function createFixtureSimnetProofSession(
  record: HeadlessLoanLifecycleRecord,
  options: CreateFixtureSimnetProofSessionOptions = {},
): SimnetProofSession {
  const now = options.now ?? new Date().toISOString();
  const summary = deriveSimnetProofReadiness({
    record,
    recentEvents: options.recentEvents,
    reviewCases: options.reviewCases,
  });

  return {
    proofSessionId: createSimnetProofSessionId(record.lookupCode),
    lookupCode: record.lookupCode,
    publicLoanReference: record.publicLoanReference,
    createdAt: now,
    updatedAt: now,
    ...summary,
  };
}

export function createSimnetProofSessionId(lookupCode: string): string {
  const compactLookup = lookupCode.replace(/[^a-zA-Z0-9]/g, "").slice(-24).toLowerCase() || "unknown";
  return `simnet-proof-${compactLookup}`;
}

function resolveReadinessStatus(input: {
  collateralReady: boolean;
  platformFeeReady: boolean;
  evidenceReady: boolean;
  reviewReady: boolean;
  releaseReady: boolean;
}): SimnetProofReadinessStatus {
  if (!input.collateralReady) return "blocked";
  if (!input.platformFeeReady) return "blocked";
  if (!input.evidenceReady) return "blocked";
  if (!input.reviewReady) return "blocked";
  if (!input.releaseReady) return "blocked";
  return "broadcast_review_blocked";
}

function resolveNextSafeOperatorAction(input: {
  collateralReady: boolean;
  platformFeeReady: boolean;
  evidenceReady: boolean;
  reviewReady: boolean;
  releaseReady: boolean;
  unsignedReleasePreviewStatus: SimnetProofGateStatus;
}): string {
  if (!input.collateralReady) return "Confirm collateral observation through the existing watcher/lifecycle event path.";
  if (!input.platformFeeReady) return "Confirm DCR platform fee output through the existing watcher/lifecycle event path.";
  if (!input.evidenceReady) return "Prepare or verify the evidence bundle/timestamp before any proof review.";
  if (!input.reviewReady) return "Resolve or close the open arbiter/manual review case before proof readiness.";
  if (!input.releaseReady) return "Wait for repayment detection or explicit collateral-release readiness.";
  if (input.unsignedReleasePreviewStatus === "ready") return "Review the placeholder checklist only. Broadcast remains blocked.";
  return "Keep the session in review-only mode.";
}

function isEvidenceReady(record: HeadlessLoanLifecycleRecord): boolean {
  return record.evidenceBundle.status === "prepared" ||
    record.evidenceBundle.status === "committed" ||
    record.evidenceBundle.timestamp.status === "anchored" ||
    record.evidenceBundle.timestamp.status === "verified";
}

function reviewBlockerDetail(record: HeadlessLoanLifecycleRecord, cases: ArbiterReviewCase[]): string {
  if (cases.length > 0) return `${cases.length} unresolved review case(s) remain open.`;
  return record.arbiterReview.detail;
}

function hasBadCollateralEvent(events: HeadlessLifecycleEvent[]): boolean {
  return events.some((event) => ["amount_mismatch", "destination_mismatch", "stale", "reorged", "missing"].includes(event.payload.collateralVerifierStatus ?? ""));
}

function hasBadPlatformFeeEvent(events: HeadlessLifecycleEvent[]): boolean {
  return events.some((event) => ["missing", "amount_mismatch", "destination_mismatch", "stale", "reorged"].includes(event.payload.platformFeeVerifierStatus ?? ""));
}

function hasBlockedIntegrityReviewEvent(events: HeadlessLifecycleEvent[], scope: "evidence" | "review"): boolean {
  return events.some((event) => {
    const review = event.payload.integrityReview;
    if (!review?.recommended) return false;
    if (scope === "evidence") return review.caseType === "evidence_incomplete";
    return review.action === "opened" || review.action === "linked";
  });
}
