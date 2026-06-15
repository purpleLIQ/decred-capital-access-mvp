"use client";

import { Activity, AlertTriangle, ArrowLeft, CheckCircle2, Database, Gauge, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import type { LoanStatus } from "@/lib/types";

type SystemHealth = {
  status: "ok" | "degraded";
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
};

export function OpsDashboard() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshHealth = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const nextHealth = (await response.json()) as SystemHealth;
      setHealth(nextHealth);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Health check failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshHealth();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [refreshHealth]);

  return (
    <main className="min-h-screen bg-[#f5f7f6] px-4 py-6 text-[#17211d] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-[#d8dfda] pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <Link className="inline-flex items-center gap-2 text-sm font-medium text-[#155e59]" href="/">
              <ArrowLeft className="h-4 w-4" />
              Back to demo console
            </Link>
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#577067]">Operator view</p>
            <h1 className="mt-1 text-3xl font-semibold">System health</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#577067]">
              Read-only operational visibility for demo mode, oracle health, loan counts, and production guardrails.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              className="inline-flex h-11 items-center justify-center rounded-md border border-[#155e59]/25 bg-white px-4 text-sm font-semibold text-[#155e59] hover:bg-[#e3f4ef]"
              href="/supplier/offers"
            >
              Supplier offers
            </Link>
            <Link
              className="inline-flex h-11 items-center justify-center rounded-md border border-[#155e59]/25 bg-white px-4 text-sm font-semibold text-[#155e59] hover:bg-[#e3f4ef]"
              href="/ops/protocol-scenario"
            >
              Protocol scenario
            </Link>
            <button
              className="inline-flex h-11 items-center justify-center rounded-md bg-[#155e59] px-4 text-sm font-semibold text-white hover:bg-[#104d49] disabled:opacity-60"
              disabled={busy}
              onClick={refreshHealth}
            >
              {busy ? "Refreshing..." : "Refresh health"}
            </button>
          </div>
        </header>

        {error ? (
          <div className="flex gap-3 rounded-lg border border-[#ed6d47] bg-[#ffe8e5] p-4 text-sm text-[#8b2f22]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        {health ? (
          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-4">
              <HealthMetric
                icon={health.status === "ok" ? CheckCircle2 : AlertTriangle}
                label="System status"
                value={health.status === "ok" ? "OK" : "Degraded"}
                detail={health.demoMode ? "Demo-safe mode is on" : "Demo mode is disabled"}
                tone={health.status === "ok" ? "good" : "warning"}
              />
              <HealthMetric
                icon={Gauge}
                label="DCR/USD"
                value={currency(health.market.dcrUsd)}
                detail={`${health.market.sourceCount} live price sources`}
                tone={health.checks.sufficientPriceSources ? "good" : "warning"}
              />
              <HealthMetric
                icon={Database}
                label="Loan book"
                value={`${health.counts.loans} loans`}
                detail={`${health.counts.activeLoans} active or repayment-stage`}
                tone="neutral"
              />
              <HealthMetric
                icon={ShieldCheck}
                label="Mainnet guardrail"
                value={health.checks.noMainnetSigning ? "Protected" : "Review"}
                detail="No real signing in demo mode"
                tone={health.checks.noMainnetSigning ? "good" : "warning"}
              />
            </section>

            <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-lg border border-[#d8dfda] bg-white p-5">
                <h2 className="text-xl font-semibold">Readiness checks</h2>
                <div className="mt-4 space-y-3">
                  <CheckRow label="Oracle healthy" passed={health.checks.oracleHealthy} />
                  <CheckRow label="Minimum price sources responding" passed={health.checks.sufficientPriceSources} />
                  <CheckRow label="Database readable" passed={health.checks.databaseReadable} />
                  <CheckRow label="No mainnet signing enabled" passed={health.checks.noMainnetSigning} />
                </div>
              </div>

              <div className="rounded-lg border border-[#d8dfda] bg-white p-5">
                <h2 className="text-xl font-semibold">Guardrails</h2>
                <div className="mt-4 space-y-2">
                  {health.guardrails.map((guardrail) => (
                    <div key={guardrail} className="rounded-md bg-[#f7f9f8] px-3 py-2 text-sm text-[#42524c]">
                      {guardrail}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-[#d8dfda] bg-white p-5">
              <h2 className="text-xl font-semibold">Loan statuses</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {Object.entries(health.counts.loansByStatus).map(([status, count]) => (
                  <div key={status} className="rounded-md bg-[#f7f9f8] px-3 py-2 text-sm">
                    <span className="font-medium capitalize">{status.replaceAll("_", " ")}</span>
                    <span className="float-right font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-[#c4d0c8] bg-white p-8 text-center text-[#6b7b74]">
            <p className="text-sm">Loading system health...</p>
          </div>
        )}
      </div>
    </main>
  );
}

function HealthMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  tone: "good" | "warning" | "neutral";
}) {
  const iconClass = tone === "good" ? "bg-[#e3f4ef] text-[#155e59]" : tone === "warning" ? "bg-[#fff4d8] text-[#855d00]" : "bg-[#eef2f1] text-[#42524c]";
  return (
    <div className="rounded-lg border border-[#d8dfda] bg-white p-4">
      <div className="flex items-center gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-md ${iconClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-[#577067]">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-[#6b7b74]">{detail}</p>
    </div>
  );
}

function CheckRow({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-[#f7f9f8] px-3 py-2 text-sm">
      <span>{label}</span>
      <span className={passed ? "font-semibold text-[#155e59]" : "font-semibold text-[#8b2f22]"}>{passed ? "Pass" : "Review"}</span>
    </div>
  );
}

function currency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}
