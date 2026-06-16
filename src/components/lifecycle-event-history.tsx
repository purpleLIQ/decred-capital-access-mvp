"use client";

import { useCallback, useEffect, useState } from "react";
import type { HeadlessLifecycleEvent } from "@/lib/headless-lifecycle-events";

export function LifecycleEventHistory() {
  const [events, setEvents] = useState<HeadlessLifecycleEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/headless-loans/event-log?limit=12", { cache: "no-store" });
      const data = (await response.json()) as { events?: HeadlessLifecycleEvent[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not load lifecycle events.");
      setEvents(data.events ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load lifecycle events.");
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  return (
    <section className="rounded-2xl border border-[#70cbff]/20 bg-[#0c1d55] p-4 shadow-xl shadow-black/20">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2ED6A1]">Lifecycle event history</p>
      <h2 className="mt-1 text-xl font-semibold">Recent transitions</h2>
      <p className="mt-1 text-sm text-white/60">Auditable events that advance stored lifecycle records through the event transition layer.</p>
      {error ? <div className="mt-3 rounded-xl border border-[#ed6d47] bg-[#ed6d47]/10 p-3 text-sm text-[#ffb19c]">{error}</div> : null}
      <div className="mt-4 space-y-3">
        {events.length ? events.map((event) => <LifecycleEventRow key={event.id} event={event} />) : <div className="rounded-xl border border-dashed border-[#70cbff]/20 bg-[#091440] p-4 text-sm text-white/60">No lifecycle events recorded yet.</div>}
      </div>
    </section>
  );
}

function LifecycleEventRow({ event }: { event: HeadlessLifecycleEvent }) {
  const isTimestampEvent = event.kind.includes("evidence_timestamp");

  return (
    <article className="rounded-xl bg-[#091440] p-3 text-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-mono text-[#70cbff]">{event.lookupCode}</p>
          <p className="mt-1 font-semibold text-white">{event.kind}</p>
          <p className="mt-1 font-mono text-xs text-white/45">{event.id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge label={event.source} />
          <Badge label={affectedSectionLabel(event.kind)} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <Metric label="Observed" value={event.observedAt} />
        <Metric label="External ref" value={event.externalReference ?? "none"} />
        <Metric label="Source" value={event.source} />
      </div>
      {isTimestampEvent ? (
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <Metric label="Evidence hash" value={event.payload.evidenceHash ?? "none"} />
          <Metric label="Provider" value={event.payload.timestampProvider ?? "none"} />
          <Metric label="Merkle root" value={event.payload.merkleRoot ?? "none"} />
          <Metric label="Chain time" value={event.payload.chainTimestamp ?? "none"} />
        </div>
      ) : null}
      <p className="mt-3 text-white/70">{event.payload.detail}</p>
      {event.payload.timestampAuditNote ? <p className="mt-2 text-xs text-[#70cbff]">{event.payload.timestampAuditNote}</p> : null}
      <p className="mt-2 text-xs text-[#2ED6A1]">{event.safetyAuditNote}</p>
    </article>
  );
}

function Badge({ label }: { label: string }) {
  return <span className="rounded-full bg-[#2ED6A1]/10 px-3 py-1 text-xs font-semibold text-[#2ED6A1]">{label}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#0c1d55] p-3"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">{label}</p><p className="mt-1 truncate font-semibold text-white">{value}</p></div>;
}

function affectedSectionLabel(kind: HeadlessLifecycleEvent["kind"]): string {
  if (kind.includes("collateral_lock")) return "collateralLock";
  if (kind.includes("platform_fee")) return "dcrPlatformFeeOutput";
  if (kind.includes("disbursement")) return "supplierDisbursement";
  if (kind.includes("repayment")) return "repaymentDetection";
  if (kind.includes("release")) return "collateralRelease";
  if (kind.includes("liquidation")) return "liquidationHealth";
  if (kind.includes("arbiter")) return "arbiterReview";
  if (kind.includes("evidence")) return "evidenceBundle";
  if (kind.includes("contact")) return "borrowerContact";
  return "quoteStatus";
}
