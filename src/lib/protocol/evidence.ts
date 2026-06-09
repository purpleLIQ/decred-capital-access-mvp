import { createHash } from "node:crypto";

import type { BorrowAsset, CollateralAsset } from "./assets";

export type EvidenceDecisionStatus = "draft" | "ready_for_review" | "blocked" | "approved" | "committed";
export type EvidenceRecommendedAction = "none" | "warn" | "request_top_up" | "arbiter_review" | "fallback_liquidation_review";
export type EvidenceCommitmentStatus = "prepared" | "anchored" | "superseded";

export interface OracleSnapshot {
  source: string;
  observedAt: string;
  dcrUsdPrice: number;
  borrowAssetUsdPrice: number;
  healthy: boolean;
}

export interface EvidenceBundle {
  id: string;
  loanId: string;
  decisionId: string;
  policyVersion: string;
  createdAt: string;
  collateralAsset: CollateralAsset;
  collateralAmount: number;
  borrowAsset: BorrowAsset;
  borrowAmount: number;
  oracleSnapshots: OracleSnapshot[];
  ltvBps: number;
  warningThresholdBps: number;
  liquidationThresholdBps: number;
  graceWindowOpen: boolean;
  arbiterWindowOpen: boolean;
  watcherConfirmations: number;
  transactionTemplateIds: string[];
  blockers: string[];
  warnings: string[];
  recommendedAction: EvidenceRecommendedAction;
  status: EvidenceDecisionStatus;
}

export interface EvidencePublicSummary {
  evidenceId: string;
  loanId: string;
  decisionId: string;
  policyVersion: string;
  createdAt: string;
  borrowAsset: BorrowAsset;
  status: EvidenceDecisionStatus;
  recommendedAction: EvidenceRecommendedAction;
  ltvBps: number;
  warningCount: number;
  blockerCount: number;
  oracleSnapshotCount: number;
}

export interface EvidenceHashCommitment {
  evidenceId: string;
  loanId: string;
  decisionId: string;
  algorithm: "sha256";
  canonicalPayload: string;
  commitmentHash: string;
  publicSummary: EvidencePublicSummary;
  createdAt: string;
}

export interface DecredEvidenceCommitmentRecord {
  id: string;
  evidenceId: string;
  loanId: string;
  commitmentHash: string;
  commitmentPayloadHex: string;
  network: "decred_simnet" | "decred_testnet" | "decred_mainnet";
  status: EvidenceCommitmentStatus;
  preparedAt: string;
  anchoredTxid?: string;
  anchoredAt?: string;
  blockHeight?: number;
}

export function createEvidencePublicSummary(bundle: EvidenceBundle): EvidencePublicSummary {
  return {
    evidenceId: bundle.id,
    loanId: bundle.loanId,
    decisionId: bundle.decisionId,
    policyVersion: bundle.policyVersion,
    createdAt: bundle.createdAt,
    borrowAsset: bundle.borrowAsset,
    status: bundle.status,
    recommendedAction: bundle.recommendedAction,
    ltvBps: bundle.ltvBps,
    warningCount: bundle.warnings.length,
    blockerCount: bundle.blockers.length,
    oracleSnapshotCount: bundle.oracleSnapshots.length,
  };
}

export function createEvidenceHashCommitment(bundle: EvidenceBundle): EvidenceHashCommitment {
  const canonicalPayload = canonicalJson(bundle);
  const commitmentHash = createHash("sha256").update(canonicalPayload, "utf8").digest("hex");

  return {
    evidenceId: bundle.id,
    loanId: bundle.loanId,
    decisionId: bundle.decisionId,
    algorithm: "sha256",
    canonicalPayload,
    commitmentHash,
    publicSummary: createEvidencePublicSummary(bundle),
    createdAt: bundle.createdAt,
  };
}

export function createDecredEvidenceCommitmentRecord(input: {
  id: string;
  commitment: EvidenceHashCommitment;
  network: DecredEvidenceCommitmentRecord["network"];
  preparedAt: string;
}): DecredEvidenceCommitmentRecord {
  return {
    id: input.id,
    evidenceId: input.commitment.evidenceId,
    loanId: input.commitment.loanId,
    commitmentHash: input.commitment.commitmentHash,
    commitmentPayloadHex: Buffer.from(`DCA_EVIDENCE:${input.commitment.commitmentHash}`, "utf8").toString("hex"),
    network: input.network,
    status: "prepared",
    preparedAt: input.preparedAt,
  };
}

export function markEvidenceCommitmentAnchored(input: {
  record: DecredEvidenceCommitmentRecord;
  anchoredTxid: string;
  anchoredAt: string;
  blockHeight: number;
}): DecredEvidenceCommitmentRecord {
  return {
    ...input.record,
    status: "anchored",
    anchoredTxid: input.anchoredTxid,
    anchoredAt: input.anchoredAt,
    blockHeight: input.blockHeight,
  };
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortForCanonicalJson(value));
}

function sortForCanonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForCanonicalJson);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortForCanonicalJson((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }

  return value;
}
