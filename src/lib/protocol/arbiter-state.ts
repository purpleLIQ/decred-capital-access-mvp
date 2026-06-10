import type { DecredEvidenceCommitmentRecord, EvidenceHashCommitment } from "./evidence";
import type { LoanHealthEvaluation } from "./oracle-policy";
import type { BorrowAssetDisbursementObservation, DecredCollateralLockObservation } from "./watcher-interfaces";

export type ArbiterCaseStatus =
  | "not_required"
  | "awaiting_evidence"
  | "ready_for_review"
  | "needs_more_evidence"
  | "borrower_release_approved"
  | "supplier_claim_approved"
  | "fallback_review_blocked"
  | "closed";

export type ArbiterDecision = "none" | "request_more_evidence" | "approve_borrower_release" | "approve_supplier_claim" | "block_fallback";
export type ArbiterEvidenceItemKind = "oracle_health" | "collateral_observation" | "disbursement_observation" | "evidence_commitment";

export interface ArbiterEvidenceItem {
  kind: ArbiterEvidenceItemKind;
  id: string;
  status: "missing" | "pending" | "accepted" | "rejected";
  blockers: string[];
}

export interface ArbiterCaseInput {
  id: string;
  loanId: string;
  openedAt: string;
  healthEvaluation?: LoanHealthEvaluation;
  collateralObservation?: DecredCollateralLockObservation;
  disbursementObservations?: BorrowAssetDisbursementObservation[];
  evidenceCommitment?: EvidenceHashCommitment;
  commitmentRecord?: DecredEvidenceCommitmentRecord;
}

export interface ArbiterCase {
  id: string;
  loanId: string;
  status: ArbiterCaseStatus;
  recommendedDecision: ArbiterDecision;
  openedAt: string;
  evidenceItems: ArbiterEvidenceItem[];
  blockers: string[];
  warnings: string[];
  fallbackExecutionAllowed: false;
}

export function createArbiterCase(input: ArbiterCaseInput): ArbiterCase {
  const evidenceItems = createArbiterEvidenceItems(input);
  const blockers = evidenceItems.flatMap((item) => item.blockers);
  const warnings = createArbiterWarnings(input);
  const recommendedDecision = resolveRecommendedDecision(input, evidenceItems);
  const status = resolveArbiterCaseStatus(recommendedDecision, evidenceItems, blockers);

  return {
    id: input.id,
    loanId: input.loanId,
    status,
    recommendedDecision,
    openedAt: input.openedAt,
    evidenceItems,
    blockers,
    warnings,
    fallbackExecutionAllowed: false,
  };
}

export function transitionArbiterCase(input: {
  arbiterCase: ArbiterCase;
  decision: ArbiterDecision;
  decidedAt: string;
  note?: string;
}): ArbiterCase {
  const status = statusForDecision(input.decision, input.arbiterCase);

  return {
    ...input.arbiterCase,
    status,
    recommendedDecision: input.decision,
    warnings: input.note ? [...input.arbiterCase.warnings, input.note] : input.arbiterCase.warnings,
    fallbackExecutionAllowed: false,
  };
}

function createArbiterEvidenceItems(input: ArbiterCaseInput): ArbiterEvidenceItem[] {
  return [
    oracleHealthEvidence(input.healthEvaluation),
    collateralEvidence(input.collateralObservation),
    ...disbursementEvidence(input.disbursementObservations ?? []),
    commitmentEvidence(input.evidenceCommitment, input.commitmentRecord),
  ];
}

function oracleHealthEvidence(evaluation?: LoanHealthEvaluation): ArbiterEvidenceItem {
  if (!evaluation) {
    return missingEvidence("oracle_health", "oracle-health", "Oracle health evaluation is required.");
  }

  return {
    kind: "oracle_health",
    id: evaluation.loanId,
    status: evaluation.blockers.length > 0 ? "rejected" : "accepted",
    blockers: evaluation.blockers,
  };
}

function collateralEvidence(observation?: DecredCollateralLockObservation): ArbiterEvidenceItem {
  if (!observation) {
    return missingEvidence("collateral_observation", "collateral-observation", "Collateral observation is required.");
  }

  const blockers = observation.status === "confirmed" ? [] : [`Collateral observation is ${observation.status}.`, ...observation.blockers];

  return {
    kind: "collateral_observation",
    id: observation.id,
    status: blockers.length === 0 ? "accepted" : "rejected",
    blockers,
  };
}

function disbursementEvidence(observations: BorrowAssetDisbursementObservation[]): ArbiterEvidenceItem[] {
  if (observations.length === 0) {
    return [missingEvidence("disbursement_observation", "disbursement-observation", "At least one disbursement observation is required.")];
  }

  return observations.map((observation) => {
    const blockers = observation.status === "confirmed" ? [] : [`Disbursement observation is ${observation.status}.`, ...observation.blockers];

    return {
      kind: "disbursement_observation",
      id: observation.id,
      status: blockers.length === 0 ? "accepted" : "rejected",
      blockers,
    };
  });
}

function commitmentEvidence(
  commitment?: EvidenceHashCommitment,
  record?: DecredEvidenceCommitmentRecord,
): ArbiterEvidenceItem {
  if (!commitment) {
    return missingEvidence("evidence_commitment", "evidence-commitment", "Evidence commitment is required.");
  }

  const blockers: string[] = [];

  if (!record) {
    blockers.push("Evidence commitment record is required.");
  } else {
    if (record.commitmentHash !== commitment.commitmentHash) {
      blockers.push("Evidence commitment record hash does not match.");
    }

    if (record.status !== "anchored") {
      blockers.push("Evidence commitment record is not anchored.");
    }
  }

  return {
    kind: "evidence_commitment",
    id: commitment.evidenceId,
    status: blockers.length === 0 ? "accepted" : "pending",
    blockers,
  };
}

function missingEvidence(
  kind: ArbiterEvidenceItemKind,
  id: string,
  message: string,
): ArbiterEvidenceItem {
  return {
    kind,
    id,
    status: "missing",
    blockers: [message],
  };
}

function createArbiterWarnings(input: ArbiterCaseInput): string[] {
  const warnings: string[] = [];

  if (input.healthEvaluation?.decision === "fallback_review_blocked") {
    warnings.push("Fallback review threshold reached, but execution remains disabled.");
  }

  return warnings;
}

function resolveRecommendedDecision(
  input: ArbiterCaseInput,
  evidenceItems: ArbiterEvidenceItem[],
): ArbiterDecision {
  if (!input.healthEvaluation || evidenceItems.some((item) => item.status === "missing" || item.status === "pending")) {
    return "request_more_evidence";
  }

  if (input.healthEvaluation.decision === "fallback_review_blocked") {
    return "block_fallback";
  }

  if (input.healthEvaluation.decision === "arbiter_review" || input.healthEvaluation.decision === "top_up_required") {
    return "approve_supplier_claim";
  }

  if (input.healthEvaluation.decision === "healthy" || input.healthEvaluation.decision === "warning") {
    return "approve_borrower_release";
  }

  return "none";
}

function resolveArbiterCaseStatus(
  decision: ArbiterDecision,
  evidenceItems: ArbiterEvidenceItem[],
  blockers: string[],
): ArbiterCaseStatus {
  if (decision === "none") {
    return "not_required";
  }

  if (evidenceItems.some((item) => item.status === "missing")) {
    return "awaiting_evidence";
  }

  if (evidenceItems.some((item) => item.status === "pending") || blockers.length > 0) {
    return "needs_more_evidence";
  }

  if (decision === "block_fallback") {
    return "fallback_review_blocked";
  }

  return "ready_for_review";
}

function statusForDecision(decision: ArbiterDecision, arbiterCase: ArbiterCase): ArbiterCaseStatus {
  if (decision === "request_more_evidence") {
    return "needs_more_evidence";
  }

  if (decision === "approve_borrower_release") {
    return "borrower_release_approved";
  }

  if (decision === "approve_supplier_claim") {
    return "supplier_claim_approved";
  }

  if (decision === "block_fallback") {
    return "fallback_review_blocked";
  }

  return arbiterCase.status;
}
