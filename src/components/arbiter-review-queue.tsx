"use client";

import { useCallback, useEffect, useState } from "react";
import type { ArbiterReviewCase } from "@/lib/arbiter-review-cases";

export function ArbiterReviewQueue() {
  const [cases, setCases] = useState<ArbiterReviewCase[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/review-cases?limit=12", { cache: "no-store" });
      const data = (await response.json()) as { cases?: ArbiterReviewCase[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not load review cases.");
      setCases(data.cases ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load review cases.");
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  return (
    <section className="rounded-2xl border border-[#70cbff]/20 bg-[#0c1d55] p-4 shadow-xl shadow-black/20">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2ED6A1]">Arbiter review queue</p>
      <h2 className="mt-1 text-xl font-semibold">Open review cases</h2>
      <p className="mt-1 text-sm text-white/60">Review cases derived from lifecycle, watcher, repayment, health, and evidence state. Actions are review decisions only.</p>
      {error ? <div className="mt-3 rounded-xl border border-[#ed6d47] bg-[#ed6d47]/10 p-3 text-sm text-[#ffb19c]">{error}</div> : null}
      <div className="mt-4 space-y-3">
        {cases.length ? cases.map((reviewCase) => <ArbiterCaseCard key={reviewCase.caseId} reviewCase={reviewCase} />) : <div className="rounded-xl border border-dashed border-[#70cbff]/20 bg-[#091440] p-4 text-sm text-white/60">No open review cases.</div>}
      </div>
    </section>
  );
}

function ArbiterCaseCard({ reviewCase }: { reviewCase: ArbiterReviewCase }) {
  return (
    <article className="rounded-xl bg-[#091440] p-3 text-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-mono text-[#70cbff]">{reviewCase.caseId}</p>
          <p className="mt-1 font-semibold text-white">{reviewCase.caseType}</p>
          <p className="mt-1 text-white/60">{reviewCase.reason}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge label={reviewCase.priority} />
          <Badge label={reviewCase.status} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <Metric label="Loan" value={reviewCase.lookupCode} />
        <Metric label="Lifecycle" value={reviewCase.relatedLifecycleStatus} />
        <Metric label="Evidence" value={reviewCase.relatedEvidenceBundleId ?? "none"} />
        <Metric label="Timestamp" value={reviewCase.evidenceTimestampStatus ?? "none"} />
        <Metric label="Watcher events" value={`${reviewCase.relatedWatcherEventIds.length}`} />
        <Metric label="Events" value={`${reviewCase.relatedLifecycleEventIds.length}`} />
        <Metric label="Deadline" value={reviewCase.reviewDeadlineAt ?? "none"} />
        <Metric label="Assigned" value={reviewCase.assignedArbiter ?? "unassigned"} />
      </div>
      <div className="mt-3 rounded-xl bg-[#0c1d55] p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#2ED6A1]">Allowed actions</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {reviewCase.allowedActions.map((action) => <Badge key={action.actionId} label={`${action.allowed ? "open" : "blocked"}: ${action.label}`} />)}
        </div>
      </div>
      <p className="mt-3 text-white/70">{reviewCase.borrowerSafeSummary}</p>
      <p className="mt-2 text-xs text-[#70cbff]">{reviewCase.safetyAuditNote}</p>
    </article>
  );
}

function Badge({ label }: { label: string }) {
  return <span className="rounded-full bg-[#2ED6A1]/10 px-3 py-1 text-xs font-semibold text-[#2ED6A1]">{label}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#0c1d55] p-3"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">{label}</p><p className="mt-1 truncate font-semibold text-white">{value}</p></div>;
}
