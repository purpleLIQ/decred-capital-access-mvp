import type { BorrowAsset, CollateralAsset } from "./assets";

export type EvidenceDecisionStatus = "draft" | "ready_for_review" | "blocked" | "approved" | "committed";
export type EvidenceRecommendedAction = "none" | "warn" | "request_top_up" | "arbiter_review" | "fallback_liquidation_review";

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
