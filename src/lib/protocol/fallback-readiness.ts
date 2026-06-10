import type { ArbiterCase } from "./arbiter-state";
import type { CollateralContractTemplate } from "./collateral-templates";
import type { DecredEvidenceCommitmentRecord } from "./evidence";
import type { LoanHealthEvaluation } from "./oracle-policy";
import type { BorrowAssetDisbursementObservation, DecredCollateralLockObservation } from "./watcher-interfaces";

export type FallbackReadinessGate =
  | "simnet_only"
  | "oracle_policy"
  | "arbiter_case"
  | "collateral_template"
  | "collateral_watcher"
  | "disbursement_watchers"
  | "evidence_commitment"
  | "transaction_template"
  | "manual_operator_review";

export type FallbackGateStatus = "passed" | "blocked" | "not_applicable";
export type FallbackReadinessDecision = "blocked" | "ready_for_manual_simnet_review";

export interface TransactionTemplateReviewPlaceholder {
  id: string;
  templateKind: "fallback_liquidation_review";
  unsignedPreviewAvailable: boolean;
  reviewedByOperator: boolean;
}

export interface ManualOperatorReviewPlaceholder {
  reviewerId?: string;
  reviewedAt?: string;
  approved: boolean;
  notes: string[];
}

export interface FallbackReadinessInput {
  loanId: string;
  network: "decred_simnet" | "decred_testnet" | "decred_mainnet";
  healthEvaluation: LoanHealthEvaluation;
  arbiterCase: ArbiterCase;
  collateralTemplate: CollateralContractTemplate;
  collateralObservation: DecredCollateralLockObservation;
  disbursementObservations: BorrowAssetDisbursementObservation[];
  evidenceCommitmentRecord: DecredEvidenceCommitmentRecord;
  transactionTemplateReview?: TransactionTemplateReviewPlaceholder;
  manualOperatorReview?: ManualOperatorReviewPlaceholder;
}

export interface FallbackGateResult {
  gate: FallbackReadinessGate;
  status: FallbackGateStatus;
  blockers: string[];
}

export interface FallbackReadinessReview {
  loanId: string;
  decision: FallbackReadinessDecision;
  canExecute: false;
  gates: FallbackGateResult[];
  blockers: string[];
}

export function evaluateFallbackReadiness(input: FallbackReadinessInput): FallbackReadinessReview {
  const gates: FallbackGateResult[] = [
    simnetOnlyGate(input),
    oraclePolicyGate(input),
    arbiterCaseGate(input),
    collateralTemplateGate(input),
    collateralWatcherGate(input),
    disbursementWatchersGate(input),
    evidenceCommitmentGate(input),
    transactionTemplateGate(input),
    manualOperatorReviewGate(input),
  ];
  const blockers = gates.flatMap((gate) => gate.blockers);

  return {
    loanId: input.loanId,
    decision: blockers.length === 0 ? "ready_for_manual_simnet_review" : "blocked",
    canExecute: false,
    gates,
    blockers,
  };
}

function passed(gate: FallbackReadinessGate): FallbackGateResult {
  return { gate, status: "passed", blockers: [] };
}

function blocked(gate: FallbackReadinessGate, blockers: string[]): FallbackGateResult {
  return { gate, status: "blocked", blockers };
}

function simnetOnlyGate(input: FallbackReadinessInput): FallbackGateResult {
  return input.network === "decred_simnet"
    ? passed("simnet_only")
    : blocked("simnet_only", ["Fallback readiness review is limited to simnet."]);
}

function oraclePolicyGate(input: FallbackReadinessInput): FallbackGateResult {
  const blockers = [...input.healthEvaluation.blockers];

  if (input.healthEvaluation.decision !== "fallback_review_blocked") {
    blockers.push("Oracle policy has not reached the fallback review threshold.");
  }

  return blockers.length === 0 ? passed("oracle_policy") : blocked("oracle_policy", blockers);
}

function arbiterCaseGate(input: FallbackReadinessInput): FallbackGateResult {
  const blockers = [...input.arbiterCase.blockers];

  if (input.arbiterCase.status !== "fallback_review_blocked") {
    blockers.push("Arbiter case has not blocked fallback review.");
  }

  if (input.arbiterCase.fallbackExecutionAllowed) {
    blockers.push("Arbiter case must not allow fallback execution.");
  }

  return blockers.length === 0 ? passed("arbiter_case") : blocked("arbiter_case", blockers);
}

function collateralTemplateGate(input: FallbackReadinessInput): FallbackGateResult {
  const blockers = [...input.collateralTemplate.blockers];
  const fallbackPath = input.collateralTemplate.spendPaths.find((path) => path.path === "fallback_liquidation_review");

  if (!fallbackPath) {
    blockers.push("Fallback review path is missing from collateral template.");
  } else if (fallbackPath.enabled) {
    blockers.push("Fallback review path must remain disabled.");
  }

  return blockers.length === 0 ? passed("collateral_template") : blocked("collateral_template", blockers);
}

function collateralWatcherGate(input: FallbackReadinessInput): FallbackGateResult {
  return input.collateralObservation.status === "confirmed"
    ? passed("collateral_watcher")
    : blocked("collateral_watcher", [
        `Collateral observation is ${input.collateralObservation.status}.`,
        ...input.collateralObservation.blockers,
      ]);
}

function disbursementWatchersGate(input: FallbackReadinessInput): FallbackGateResult {
  if (input.disbursementObservations.length === 0) {
    return blocked("disbursement_watchers", ["At least one disbursement observation is required."]);
  }

  const blockers = input.disbursementObservations.flatMap((observation) =>
    observation.status === "confirmed" ? [] : [`Disbursement observation ${observation.id} is ${observation.status}.`, ...observation.blockers],
  );

  return blockers.length === 0 ? passed("disbursement_watchers") : blocked("disbursement_watchers", blockers);
}

function evidenceCommitmentGate(input: FallbackReadinessInput): FallbackGateResult {
  const blockers: string[] = [];

  if (input.evidenceCommitmentRecord.status !== "anchored") {
    blockers.push("Evidence commitment record is not anchored.");
  }

  return blockers.length === 0 ? passed("evidence_commitment") : blocked("evidence_commitment", blockers);
}

function transactionTemplateGate(input: FallbackReadinessInput): FallbackGateResult {
  const blockers: string[] = [];

  if (!input.transactionTemplateReview) {
    blockers.push("Transaction template review is required.");
  } else {
    if (!input.transactionTemplateReview.unsignedPreviewAvailable) {
      blockers.push("Unsigned transaction preview is required.");
    }

    if (!input.transactionTemplateReview.reviewedByOperator) {
      blockers.push("Operator transaction-template review is required.");
    }
  }

  return blockers.length === 0 ? passed("transaction_template") : blocked("transaction_template", blockers);
}

function manualOperatorReviewGate(input: FallbackReadinessInput): FallbackGateResult {
  if (!input.manualOperatorReview?.approved) {
    return blocked("manual_operator_review", ["Manual operator approval is required."]);
  }

  return passed("manual_operator_review");
}
