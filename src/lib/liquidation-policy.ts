import { protocolConfig } from "./protocol-config";
import { isOracleHealthy } from "./risk";
import type { Loan, MarketSnapshot } from "./types";

export type LiquidationAutomationAction = "none" | "warn" | "queue_review" | "auto_liquidate";

export interface LiquidationContext {
  loan: Loan;
  market: MarketSnapshot;
  dexDepthUsd: number;
  minutesSinceWarning?: number;
}

export interface LiquidationDecision {
  action: LiquidationAutomationAction;
  automationAllowed: boolean;
  requiresTransactionReview: boolean;
  signingAllowed: false;
  broadcastAllowed: false;
  reasons: string[];
  blockers: string[];
}

export function evaluateLiquidationAutomation(context: LiquidationContext): LiquidationDecision {
  const reasons: string[] = [];
  const blockers: string[] = [];
  const oracleHealthy = isOracleHealthy(context.market);
  const ltvBps = context.loan.currentLtvBps;

  if (ltvBps < protocolConfig.warningLtvBps) {
    return {
      action: "none",
      automationAllowed: false,
      requiresTransactionReview: false,
      signingAllowed: false,
      broadcastAllowed: false,
      reasons: ["Loan is below the warning threshold."],
      blockers: [],
    };
  }

  if (ltvBps >= protocolConfig.warningLtvBps) {
    reasons.push("Loan is above the warning threshold.");
  }

  if (ltvBps >= protocolConfig.liquidationLtvBps) {
    reasons.push("Loan is above the liquidation threshold.");
  }

  if (protocolConfig.automationRequiresHealthyOracle && !oracleHealthy) {
    blockers.push("Oracle must be healthy before automated liquidation can run.");
  }

  if (context.dexDepthUsd < protocolConfig.minLiquidationDexDepthUsd) {
    blockers.push("DEX depth is below the configured automated liquidation minimum.");
  }

  if ((context.minutesSinceWarning ?? 0) < protocolConfig.liquidationGracePeriodMinutes) {
    blockers.push("Grace period has not elapsed since warning.");
  }

  if (ltvBps >= protocolConfig.hardLiquidationLtvBps && blockers.length === 0) {
    return {
      action: "auto_liquidate",
      automationAllowed: true,
      requiresTransactionReview: true,
      signingAllowed: false,
      broadcastAllowed: false,
      reasons,
      blockers,
    };
  }

  if (ltvBps >= protocolConfig.liquidationLtvBps) {
    return {
      action: "queue_review",
      automationAllowed: false,
      requiresTransactionReview: true,
      signingAllowed: false,
      broadcastAllowed: false,
      reasons,
      blockers,
    };
  }

  return {
    action: "warn",
    automationAllowed: false,
    requiresTransactionReview: false,
    signingAllowed: false,
    broadcastAllowed: false,
    reasons,
    blockers,
  };
}
