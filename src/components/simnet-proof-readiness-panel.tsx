"use client";

import { RefreshCw, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { HeadlessLoanLifecycleRecord } from "@/lib/headless-loan-lifecycle";
import { createFixtureSimnetProofSession, type SimnetProofSession } from "@/lib/simnet-proof-readiness";

export function SimnetProofReadinessPanel({ record }: { record: HeadlessLoanLifecycleRecord }) {
  const previewSession = useMemo(() => createFixtureSimnetProofSession(record), [record]);
  const [storedSession, setStoredSession] = useState<SimnetProofSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  const session = storedSession?.lookupCode === record.lookupCode ? storedSession : previewSession;

  useEffect(() => {
    let cancelled = false;

    async function loadStoredSession() {
      try {
        const response = await fetch(`/api/simnet-proof-readiness?lookupCode=${encodeURIComponent(record.lookupCode)}&limit=1`, { cache: "no-store" });
        const data = (await response.json()) as { sessions?: SimnetProofSession[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Could not load simnet proof session.");
        if (!cancelled && data.sessions?.[0]) setStoredSession(data.sessions[0]);
      } catch {
        if (!cancelled) setRefreshNote("Showing deterministic preview from the lifecycle record.");
      }
    }

    void loadStoredSession();
    return () => {
      cancelled = true;
    };
  }, [record]);

  async function refreshSession() {
    setBusy(true);
    setError(null);
    setRefreshNote(null);
    try {
      const response = await fetch("/api/simnet-proof-readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookupCode: record.lookupCode }),
      });
      const data = (await response.json()) as { session?: SimnetProofSession; safetyNote?: string; error?: string };
      if (!response.ok || !data.session) throw new Error(data.error ?? "Could not refresh simnet proof session.");
      setStoredSession(data.session);
      setRefreshNote(data.safetyNote ?? "Session refreshed from stored lifecycle, event, and review state.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not refresh simnet proof session.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-[#70cbff]/20 bg-[#091440] p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#2ED6A1]">
            <ShieldAlert className="h-4 w-4" />
            Simnet proof readiness
          </p>
          <p className="mt-1 text-sm text-white/60">Review-only proof session scaffold for future simnet validation. No signing, no broadcast, no real funds.</p>
        </div>
        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#2970ff] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} onClick={refreshSession}>
          <RefreshCw className="h-4 w-4" />
          {busy ? "Refreshing" : "Seed/refresh proof session"}
        </button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-5">
        <Metric label="Proof status" value={formatStatus(session.status)} />
        <Metric label="Unsigned preview" value={formatStatus(session.unsignedReleasePreviewStatus)} />
        <Metric label="Signing session" value={formatStatus(session.signingSessionStatus)} />
        <Metric label="Signed hex" value={formatStatus(session.signedHexSubmissionStatus)} />
        <Metric label="Broadcast" value="Broadcast blocked" />
      </div>

      <div className="mt-3 rounded-xl border border-[#ed6d47]/30 bg-[#ed6d47]/10 p-3 text-sm text-[#ffb19c]">
        Broadcast blocked. No signing, no broadcast, no real funds.
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-xl bg-[#0c1d55] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">Proof checklist</p>
          <div className="mt-3 grid gap-2">
            {session.checklistItems.map((item) => (
              <div key={item.id} className="grid gap-2 rounded-lg border border-white/10 bg-[#091440] p-3 text-sm sm:grid-cols-[10rem_1fr]">
                <span className={item.status === "ready" ? "font-semibold text-[#2ED6A1]" : "font-semibold text-[#ffb19c]"}>{formatStatus(item.status)}</span>
                <span className="text-white/72">{item.label}: {item.detail}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-[#0c1d55] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">Next safe operator action</p>
          <p className="mt-2 text-sm text-white/75">{session.nextSafeOperatorAction}</p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-white/45">Blockers</p>
          <ul className="mt-2 space-y-2 text-sm text-white/70">
            {session.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
          </ul>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-white/45">Safety notes</p>
          <p className="mt-2 text-sm text-white/65">{session.safetyNotes.join(" ")}</p>
        </div>
      </div>

      {refreshNote ? <p className="mt-3 text-xs text-[#70cbff]">{refreshNote}</p> : null}
      {error ? <div className="mt-3 rounded-xl border border-[#ed6d47] bg-[#ed6d47]/10 p-3 text-sm text-[#ffb19c]">{error}</div> : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#0c1d55] p-3"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">{label}</p><p className="mt-1 truncate font-semibold text-white">{value}</p></div>;
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ");
}
