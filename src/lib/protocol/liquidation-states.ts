export type LiquidationPhase =
  | "healthy"
  | "warning_window"
  | "top_up_window"
  | "arbiter_intervention"
  | "fallback_liquidation_review"
  | "resolved";

export interface LiquidationPolicyPlaceholder {
  policyVersion: string;
  warningLtvBps: number;
  liquidationLtvBps: number;
  arbiterWindowMinutes: number;
  automaticFallbackEnabled: false;
}

export interface LiquidationState {
  loanId: string;
  phase: LiquidationPhase;
  policyVersion: string;
  currentLtvBps: number;
  warnings: string[];
  blockers: string[];
  arbiterRequired: boolean;
  automaticFallbackAllowed: false;
}

export function createInitialLiquidationState(input: {
  loanId: string;
  policy: LiquidationPolicyPlaceholder;
  currentLtvBps: number;
}): LiquidationState {
  const phase: LiquidationPhase =
    input.currentLtvBps >= input.policy.liquidationLtvBps
      ? "arbiter_intervention"
      : input.currentLtvBps >= input.policy.warningLtvBps
        ? "warning_window"
        : "healthy";

  return {
    loanId: input.loanId,
    phase,
    policyVersion: input.policy.policyVersion,
    currentLtvBps: input.currentLtvBps,
    warnings: phase === "healthy" ? [] : ["Loan health threshold reached."],
    blockers: ["Automatic fallback liquidation requires future oracle, arbiter, watcher, verifier, template, evidence, and simnet proof gates."],
    arbiterRequired: phase === "arbiter_intervention",
    automaticFallbackAllowed: false,
  };
}
