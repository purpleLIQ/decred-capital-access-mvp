"use client";

import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArbiterReviewQueue } from "@/components/arbiter-review-queue";
import { GuidedOperatorDemoScenarioPanel } from "@/components/guided-operator-demo-scenario-panel";
import { LifecycleEventHistory } from "@/components/lifecycle-event-history";
import { SimnetProofReadinessPanel } from "@/components/simnet-proof-readiness-panel";
import type { HeadlessLoanLifecycleRecord } from "@/lib/headless-loan-lifecycle";
import type { LiquidationHealthFixtureScenarioName, SubmittedLiquidationHealthFixtureScenario } from "@/lib/oracle-liquidation-health-fixtures";

const liquidationHealthScenarioOptions: Array<{ value: LiquidationHealthFixtureScenarioName; label: string }> = [
  { value: "healthy_loan", label: "Healthy loan" },
  { value: "warning_state", label: "Warning state" },
  { value: "margin_call_state", label: "Margin call state" },
  { value: "liquidation_eligible_state", label: "Liquidation eligible state" },
  { value: "stale_oracle", label: "Stale oracle" },
  { value: "deviated_oracle", label: "Deviated oracle" },
  { value: "stale_watcher", label: "Stale watcher" },
  { value: "borrower_warning_opened", label: "Borrower warning opened" },
  { value: "top_up_requested", label: "Top-up requested" },
  { value: "arbiter_review_case_opened", label: "Arbiter review case opened" },
  { value: "evidence_summary_prepared", label: "Evidence summary prepared" },
];

export function OpsLifecycleRecords() {
  const [records, setRecords] = useState<HeadlessLoanLifecycleRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [derivedPanelKey, setDerivedPanelKey] = useState(0);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/headless-loans?limit=12", { cache: "no-store" });
      const data = (await response.json()) as { records?: HeadlessLoanLifecycleRecord[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not load lifecycle records.");
      setRecords(data.records ?? []);
      setDerivedPanelKey((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load lifecycle records.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  function handleRecordUpdated(record: HeadlessLoanLifecycleRecord) {
    setRecords((existing) => [record, ...existing.filter((item) => item.lookupCode !== record.lookupCode)]);
    setDerivedPanelKey((value) => value + 1);
  }

  return (
    <main className="min-h-screen bg-[#091440] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-[#70cbff]/20 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <Link className="inline-flex items-center gap-2 text-sm font-medium text-[#70cbff]" href="/ops">
              <ArrowLeft className="h-4 w-4" />
              Back to ops
            </Link>
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#2ED6A1]">Lifecycle store</p>
            <h1 className="mt-1 text-3xl font-semibold">Headless loan records</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/68">
              Recent accountless borrower lifecycle records loaded through the same store/API boundary used by borrower lookup, with transition events and arbiter review cases from production-shaped store boundaries.
            </p>
          </div>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#2970ff] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
            {busy ? "Refreshing" : "Refresh records"}
          </button>
        </header>

        {error ? <div className="rounded-xl border border-[#ed6d47] bg-[#ed6d47]/10 p-4 text-sm text-[#ffb19c]">{error}</div> : null}

        <section className="grid gap-4">
          {records.length ? (
            records.map((record) => <LifecycleRecordCard key={record.lookupCode} record={record} onRecordUpdated={handleRecordUpdated} />)
          ) : (
            <div className="rounded-2xl border border-dashed border-[#70cbff]/25 bg-[#0c1d55] p-8 text-center text-white/60">
              No lifecycle records saved yet. Accept a quote from the borrower flow to create the first record.
            </div>
          )}
        </section>

        <ArbiterReviewQueue key={`arbiter-${derivedPanelKey}`} />
        <LifecycleEventHistory key={`events-${derivedPanelKey}`} />
      </div>
    </main>
  );
}

function LifecycleRecordCard({ record, onRecordUpdated }: { record: HeadlessLoanLifecycleRecord; onRecordUpdated: (record: HeadlessLoanLifecycleRecord) => void }) {
  return (
    <article className="rounded-2xl border border-[#70cbff]/20 bg-[#0c1d55] p-4 shadow-xl shadow-black/20">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-mono text-lg font-semibold text-[#70cbff]">{record.publicLoanReference}</p>
          <p className="mt-1 text-sm text-white/60">Created {record.timestamps.createdAt} · Updated {record.timestamps.lastUpdatedAt}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge label={record.lifecycleStatus} />
          <Badge label={record.fundingRoute.status} />
          <Badge label={`health: ${record.liquidationHealth.status}`} />
          {record.oracleHealth ? <Badge label={`oracle: ${record.oracleHealth.oracleFreshnessStatus}`} /> : null}
          {record.borrowerWarningWindow?.status && record.borrowerWarningWindow.status !== "not_required" ? <Badge label={record.borrowerWarningWindow.status} /> : null}
          {record.arbiterReview.status === "requested" ? <Badge label="arbiter review open" /> : null}
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Metric label="Asset" value={record.borrowAsset} />
        <Metric label="Requested" value={formatAssetAmount(record.requestedAmount, record.borrowAsset)} />
        <Metric label="Supplier positions" value={`${record.supplierPositions.length}`} />
        <Metric label="Funding" value={record.fundingStatus} />
      </div>
      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-xl bg-[#091440] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#2ED6A1]">Next borrower action</p>
          <p className="mt-2 text-white/75">{record.nextBorrowerAction}</p>
        </div>
        <div className="rounded-xl bg-[#091440] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#2ED6A1]">Next supplier/operator action</p>
          <p className="mt-2 text-white/75">{record.nextSupplierOperatorAction}</p>
        </div>
      </div>
      <GuidedOperatorDemoScenarioPanel record={record} onRecordUpdated={onRecordUpdated} />
      <LiquidationHealthScenarioControl record={record} onRecordUpdated={onRecordUpdated} />
      <OracleHealthPanel record={record} />
      <SimnetProofReadinessPanel record={record} />
    </article>
  );
}

function LiquidationHealthScenarioControl({ record, onRecordUpdated }: { record: HeadlessLoanLifecycleRecord; onRecordUpdated: (record: HeadlessLoanLifecycleRecord) => void }) {
  const [scenario, setScenario] = useState<LiquidationHealthFixtureScenarioName>("healthy_loan");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmittedLiquidationHealthFixtureScenario | null>(null);

  async function submitScenario() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/oracle-liquidation-health/fixture-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookupCode: record.lookupCode, scenario }),
      });
      const data = (await response.json()) as SubmittedLiquidationHealthFixtureScenario & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not submit liquidation-health fixture scenario.");
      setResult(data);
      onRecordUpdated(data.finalRecord);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit liquidation-health fixture scenario.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-[#70cbff]/20 bg-[#091440] p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#2ED6A1]">Operator-only fixture health scenario</p>
          <p className="mt-1 text-sm text-white/60">Submits through the existing lifecycle event/store and arbiter case paths. Automatic liquidation remains blocked.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select className="h-10 rounded-md border border-[#70cbff]/20 bg-[#0c1d55] px-3 text-sm text-white" onChange={(event) => setScenario(event.target.value as LiquidationHealthFixtureScenarioName)} value={scenario}>
            {liquidationHealthScenarioOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button className="h-10 rounded-md bg-[#2970ff] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} onClick={submitScenario}>
            {busy ? "Submitting" : "Submit scenario"}
          </button>
        </div>
      </div>
      {error ? <div className="mt-3 rounded-xl border border-[#ed6d47] bg-[#ed6d47]/10 p-3 text-sm text-[#ffb19c]">{error}</div> : null}
      {result ? (
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Metric label="Scenario" value={labelForScenario(result.scenario)} />
          <Metric label="Health" value={result.healthResult.status} />
          <Metric label="Arbiter cases" value={`${result.arbiterCases.length}`} />
          <Metric label="Events" value={`${result.submittedEvents.length}`} />
          <Metric label="Oracle usable" value={result.healthResult.oracleUsable ? "yes" : "no"} />
          <Metric label="Blocker" value={result.healthResult.blockerReason ?? "none"} />
          <Metric label="Evidence" value={result.evidenceSummary.healthResultId} />
          <Metric label="Auto liquidation" value={result.healthResult.automaticLiquidationBlocked ? "blocked" : "not blocked"} />
        </div>
      ) : null}
      {result ? <p className="mt-3 text-xs text-white/45">{result.safetyNote}</p> : null}
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return <span className="rounded-full bg-[#2ED6A1]/10 px-3 py-1 text-xs font-semibold text-[#2ED6A1]">{label}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#091440] p-3"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">{label}</p><p className="mt-1 truncate font-semibold text-white">{value}</p></div>;
}

function OracleHealthPanel({ record }: { record: HeadlessLoanLifecycleRecord }) {
  const health = record.oracleHealth;
  const warningWindow = record.borrowerWarningWindow;

  if (!health) return null;

  return (
    <div className="mt-4 rounded-xl bg-[#091440] p-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#2ED6A1]">Oracle/liquidation health</p>
          <p className="mt-2 text-sm text-white/75">{health.operatorInternalSummary}</p>
        </div>
        <Badge label={health.automaticLiquidationBlocked ? "automatic liquidation blocked" : "review required"} />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <Metric label="LTV" value={formatBps(health.ltvBps)} />
        <Metric label="Collateral value" value={formatUsd(health.collateralValueUsd)} />
        <Metric label="Debt value" value={formatUsd(health.debtValueUsd)} />
        <Metric label="DCR/USD" value={formatUsd(health.selectedDcrUsdPrice)} />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <Metric label={`${record.borrowAsset}/USD`} value={formatUsd(health.selectedBorrowAssetUsdPrice)} />
        <Metric label="Oracle freshness" value={health.oracleFreshnessStatus} />
        <Metric label="Deviation" value={health.oracleDeviationStatus} />
        <Metric label="Quorum" value={`${health.oracleSourceCount} sources / ${health.oracleQuorumStatus}`} />
        <Metric label="Usable" value={health.oracleUsable ? "yes" : "no"} />
        <Metric label="Review signal" value={health.shouldOpenArbiterReview ? "arbiter review" : "none"} />
        <Metric label="Evidence summary" value={health.resultId} />
        <Metric label="Policy" value={health.policyVersion} />
      </div>
      <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-xl bg-[#0c1d55] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">Borrower warning/top-up</p>
          <p className="mt-2 text-white/75">
            {warningWindow?.status ?? "not_required"}
            {warningWindow?.warningDeadline ? ` until ${warningWindow.warningDeadline}` : ""}
            {warningWindow?.topUpRequested ? `; placeholder top-up ${formatDcr(warningWindow.topUpPlaceholderAmountDcr)}` : ""}
          </p>
        </div>
        <div className="rounded-xl bg-[#0c1d55] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">Review blocker</p>
          <p className="mt-2 text-white/75">{health.blockerReason ?? health.nextOperatorArbiterAction}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-white/45">{health.auditNote}</p>
    </div>
  );
}

function labelForScenario(scenario: LiquidationHealthFixtureScenarioName): string {
  return liquidationHealthScenarioOptions.find((option) => option.value === scenario)?.label ?? scenario;
}

function formatBps(value: number | undefined): string {
  if (typeof value !== "number") return "not evaluated";
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} bps`;
}

function formatUsd(value: number | undefined): string {
  if (typeof value !== "number") return "not evaluated";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatDcr(value: number | undefined): string {
  if (typeof value !== "number") return "0 DCR";
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 8 })} DCR`;
}

function formatAssetAmount(amount: number, asset: HeadlessLoanLifecycleRecord["borrowAsset"]): string {
  return `${amount.toLocaleString("en-US", { maximumFractionDigits: asset === "BTC" ? 8 : 2 })} ${asset}`;
}
