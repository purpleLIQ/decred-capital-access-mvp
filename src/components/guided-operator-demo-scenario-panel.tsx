"use client";

import { Play, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { GuidedOperatorDemoAction, GuidedOperatorDemoScenario, GuidedOperatorDemoScenarioType } from "@/lib/guided-operator-demo-scenario";
import type { HeadlessLoanLifecycleRecord } from "@/lib/headless-loan-lifecycle";

export function GuidedOperatorDemoScenarioPanel({ record, onRecordUpdated }: { record: HeadlessLoanLifecycleRecord; onRecordUpdated: (record: HeadlessLoanLifecycleRecord) => void }) {
  const [scenario, setScenario] = useState<GuidedOperatorDemoScenario | null>(null);
  const [busyAction, setBusyAction] = useState<GuidedOperatorDemoAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [scenarioType, setScenarioType] = useState<GuidedOperatorDemoScenarioType>("control_plane");

  useEffect(() => {
    let cancelled = false;

    async function loadScenario() {
      try {
        const response = await fetch(`/api/guided-operator-demo-scenario?lookupCode=${encodeURIComponent(record.lookupCode)}&scenarioType=${scenarioType}`, { cache: "no-store" });
        const data = (await response.json()) as { scenario?: GuidedOperatorDemoScenario; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Could not load guided demo scenario.");
        if (!cancelled) setScenario(data.scenario ?? null);
      } catch {
        if (!cancelled) setScenario(null);
      }
    }

    void loadScenario();
    return () => {
      cancelled = true;
    };
  }, [record.lookupCode, scenarioType]);

  async function submitAction(action: GuidedOperatorDemoAction, overrideScenarioType = scenarioType) {
    setBusyAction(action);
    setError(null);
    setNote(null);
    try {
      const response = await fetch("/api/guided-operator-demo-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookupCode: record.lookupCode, action, scenarioType: overrideScenarioType }),
      });
      const data = (await response.json()) as { scenario?: GuidedOperatorDemoScenario; record?: HeadlessLoanLifecycleRecord; safetyNote?: string; error?: string };
      if (!response.ok || !data.scenario || !data.record) throw new Error(data.error ?? "Could not run guided demo scenario.");
      setScenario(data.scenario);
      onRecordUpdated(data.record);
      setNote(data.safetyNote ?? "Guided demo state refreshed.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not run guided demo scenario.");
    } finally {
      setBusyAction(null);
    }
  }

  const currentScenario = scenario;

  return (
    <div className="mt-4 rounded-xl border border-[#70cbff]/20 bg-[#091440] p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#2ED6A1]">
            <ShieldCheck className="h-4 w-4" />
            Guided demo scenario
          </p>
          <p className="mt-1 text-sm text-white/60">Operator-only fixture workflow across lifecycle, watcher, oracle, review, repayment, top-up, release readiness, and proof state.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select className="h-10 rounded-md border border-[#70cbff]/20 bg-[#0c1d55] px-3 text-sm text-white" onChange={(event) => setScenarioType(event.target.value as GuidedOperatorDemoScenarioType)} value={scenarioType}>
            <option value="control_plane">Control plane</option>
            <option value="repayment_release_readiness">Repayment release readiness</option>
            <option value="partial_repayment_review">Partial repayment review</option>
            <option value="repayment_dispute_review">Repayment dispute review</option>
            <option value="top_up_review">Top-up review</option>
          </select>
          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#70cbff]/25 px-3 text-sm font-semibold text-white disabled:opacity-60" disabled={Boolean(busyAction)} onClick={() => void submitAction("refresh")}>
            <RefreshCw className="h-4 w-4" />
            {busyAction === "refresh" ? "Refreshing" : "Refresh"}
          </button>
          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#2970ff] px-3 text-sm font-semibold text-white disabled:opacity-60" disabled={Boolean(busyAction)} onClick={() => void submitAction("run_next")}>
            <Play className="h-4 w-4" />
            {busyAction === "run_next" ? "Running" : "Run next"}
          </button>
          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#2ED6A1] px-3 text-sm font-semibold text-[#091440] disabled:opacity-60" disabled={Boolean(busyAction)} onClick={() => void submitAction("run_all")}>
            <Play className="h-4 w-4" />
            {busyAction === "run_all" ? "Running" : "Run selected preset"}
          </button>
          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#70cbff] px-3 text-sm font-semibold text-[#091440] disabled:opacity-60" disabled={Boolean(busyAction)} onClick={() => {
            setScenarioType("repayment_release_readiness");
            void submitAction("run_all", "repayment_release_readiness");
          }}>
            <Play className="h-4 w-4" />
            Run repayment preset
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <Metric label="Preset" value={currentScenario?.scenarioType ? formatStatus(currentScenario.scenarioType) : formatStatus(scenarioType)} />
        <Metric label="Phase" value={currentScenario?.phase ?? "not loaded"} />
        <Metric label="Completed" value={currentScenario ? `${currentScenario.completedStepCount}/${currentScenario.steps.length}` : "0/0"} />
        <Metric label="Next action" value={currentScenario?.nextSafeOperatorAction ?? "Refresh scenario"} />
        <Metric label="Repayment" value={currentScenario?.repaymentStatus ?? record.repaymentDetection.status} />
        <Metric label="Release readiness" value={currentScenario?.releaseReadinessStatus ?? record.collateralRelease.status} />
        <Metric label="Proof readiness" value={currentScenario?.proofReadinessStatus ? formatStatus(currentScenario.proofReadinessStatus) : "not started"} />
        <Metric label="Proof session" value={currentScenario?.simnetProofSessionId ?? "none"} />
      </div>

      <div className="mt-3 rounded-xl border border-[#ed6d47]/30 bg-[#ed6d47]/10 p-3 text-sm text-[#ffb19c]">
        Broadcast blocked. No signing, no broadcast, no real funds.
      </div>

      {currentScenario ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl bg-[#0c1d55] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">Scenario steps</p>
            <div className="mt-3 grid gap-2">
              {currentScenario.steps.map((step) => (
                <div key={step.id} className="grid gap-2 rounded-lg border border-white/10 bg-[#091440] p-3 text-sm sm:grid-cols-[7rem_1fr]">
                  <span className={step.status === "complete" ? "font-semibold text-[#2ED6A1]" : step.status === "available" ? "font-semibold text-[#70cbff]" : "font-semibold text-white/45"}>{formatStatus(step.status)}</span>
                  <span className="text-white/72">{step.label}: {step.detail}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-[#0c1d55] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">Scenario evidence</p>
            <div className="mt-3 grid gap-3">
              <Metric label="Borrower-safe status" value={currentScenario.borrowerSafeStatus} />
              <Metric label="Selected preset" value={formatStatus(currentScenario.scenarioType)} />
              <Metric label="Event ids" value={currentScenario.eventIdsEmitted.length ? currentScenario.eventIdsEmitted.join(", ") : "none"} />
              <Metric label="Case ids" value={currentScenario.arbiterCaseIds.length ? currentScenario.arbiterCaseIds.join(", ") : "none"} />
              <Metric label="Broadcast" value="blocked" />
            </div>
            <p className="mt-3 text-xs text-white/50">{currentScenario.safetyNotes.join(" ")}</p>
          </div>
        </div>
      ) : null}

      {note ? <p className="mt-3 text-xs text-[#70cbff]">{note}</p> : null}
      {error ? <div className="mt-3 rounded-xl border border-[#ed6d47] bg-[#ed6d47]/10 p-3 text-sm text-[#ffb19c]">{error}</div> : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#091440] p-3"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">{label}</p><p className="mt-1 truncate font-semibold text-white">{value}</p></div>;
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ");
}
