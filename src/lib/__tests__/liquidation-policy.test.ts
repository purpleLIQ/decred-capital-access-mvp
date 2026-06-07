import { describe, expect, it } from "vitest";
import { demoLoans, demoMarketSnapshot } from "../fixtures";
import { protocolConfig } from "../protocol-config";
import { evaluateLiquidationAutomation } from "../liquidation-policy";
import type { Loan, MarketSnapshot } from "../types";

function loanAtLtv(ltvBps: number): Loan {
  return { ...demoLoans[0], currentLtvBps: ltvBps };
}

function marketOverride(overrides: Partial<MarketSnapshot>): MarketSnapshot {
  return { ...demoMarketSnapshot, ...overrides };
}

describe("liquidation automation policy", () => {
  it("takes no action below warning threshold", () => {
    const decision = evaluateLiquidationAutomation({
      loan: loanAtLtv(protocolConfig.warningLtvBps - 1),
      market: demoMarketSnapshot,
      dexDepthUsd: protocolConfig.minLiquidationDexDepthUsd,
      minutesSinceWarning: protocolConfig.liquidationGracePeriodMinutes,
    });

    expect(decision.action).toBe("none");
    expect(decision.automationAllowed).toBe(false);
  });

  it("queues review at liquidation threshold when automation blockers remain", () => {
    const decision = evaluateLiquidationAutomation({
      loan: loanAtLtv(protocolConfig.liquidationLtvBps),
      market: marketOverride({ sourceCount: 1 }),
      dexDepthUsd: 100,
      minutesSinceWarning: 0,
    });

    expect(decision.action).toBe("queue_review");
    expect(decision.automationAllowed).toBe(false);
    expect(decision.blockers).toContain("Oracle must be healthy before automated liquidation can run.");
  });

  it("allows automated liquidation only past hard threshold with all guardrails satisfied", () => {
    const decision = evaluateLiquidationAutomation({
      loan: loanAtLtv(protocolConfig.hardLiquidationLtvBps),
      market: demoMarketSnapshot,
      dexDepthUsd: protocolConfig.minLiquidationDexDepthUsd,
      minutesSinceWarning: protocolConfig.liquidationGracePeriodMinutes,
    });

    expect(decision.action).toBe("auto_liquidate");
    expect(decision.automationAllowed).toBe(true);
    expect(decision.blockers).toEqual([]);
  });
});
