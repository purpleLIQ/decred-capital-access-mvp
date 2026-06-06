import { listLoans } from "./demo-db";
import { getMarketSnapshot } from "./price-oracle";
import { protocolConfig } from "./protocol-config";
import { isOracleHealthy } from "./risk";
import type { LoanStatus } from "./types";

export type HealthStatus = "ok" | "degraded";

export interface SystemHealth {
  status: HealthStatus;
  demoMode: boolean;
  checks: {
    oracleHealthy: boolean;
    sufficientPriceSources: boolean;
    noMainnetSigning: boolean;
    databaseReadable: boolean;
  };
  counts: {
    loans: number;
    activeLoans: number;
    loansByStatus: Partial<Record<LoanStatus, number>>;
  };
  market: {
    dcrUsd: number;
    sourceCount: number;
    stale: boolean;
    warnings: string[];
    updatedAt: string;
  };
  guardrails: string[];
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const [loans, market] = await Promise.all([listLoans(), getMarketSnapshot()]);
  const loansByStatus = loans.reduce<Partial<Record<LoanStatus, number>>>((summary, loan) => {
    summary[loan.status] = (summary[loan.status] ?? 0) + 1;
    return summary;
  }, {});
  const oracleHealthy = isOracleHealthy(market);
  const sufficientPriceSources = market.sourceCount >= protocolConfig.minLivePriceSources;
  const activeLoans = loans.filter((loan) => ["funded", "active", "repayment_pending"].includes(loan.status)).length;
  const checks = {
    oracleHealthy,
    sufficientPriceSources,
    noMainnetSigning: protocolConfig.demoMode,
    databaseReadable: true,
  };
  const status: HealthStatus = Object.values(checks).every(Boolean) ? "ok" : "degraded";

  return {
    status,
    demoMode: protocolConfig.demoMode,
    checks,
    counts: {
      loans: loans.length,
      activeLoans,
      loansByStatus,
    },
    market: {
      dcrUsd: market.dcrUsd,
      sourceCount: market.sourceCount,
      stale: market.stale,
      warnings: market.warnings,
      updatedAt: market.updatedAt,
    },
    guardrails: [
      "Demo mode does not touch mainnet funds.",
      "No private keys are stored in the demo database.",
      "Real signing must wait for Decred simnet validation.",
      "Operator review remains required for liquidation and degraded oracle states.",
    ],
  };
}
