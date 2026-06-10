"use client";

import { ArrowLeft, CheckCircle2, Database, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";

type ProtocolScenarioPayload = {
  readOnly: boolean;
  summary: {
    loanRequestId: string;
    borrowAsset: string;
    collateralAsset: string;
    fundingStatus: string;
    activationEligible: boolean;
    supplierCount: number;
    collateralTemplateStatus: string;
    collateralObservationStatus: string;
    disbursementObservationStatuses: string[];
    evidenceRecordStatus: string;
    evidenceCommitmentHash: string;
    platformFeeAmount: number;
    arbiterReserveAmount: number;
    notes: string[];
  };
  quote: {
    borrowerAprBps: number;
    totalDue: number;
    collateralRequiredWithFee: number;
  };
  evidence: {
    record: {
      status: string;
      network: string;
      blockHeight?: number;
    };
  };
  notes: string[];
};

export function OpsProtocolScenario() {
  const [payload, setPayload] = useState<ProtocolScenarioPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/protocol-scenario", { cache: "no-store" });
      const nextPayload = (await response.json()) as ProtocolScenarioPayload;
      setPayload(nextPayload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Protocol scenario failed to load.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [refresh]);

  return (
    <main className="min-h-screen bg-[#f5f7f6] px-4 py-6 text-[#17211d] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-[#d8dfda] pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <Link className="inline-flex items-center gap-2 text-sm font-medium text-[#155e59]" href="/ops">
              <ArrowLeft className="h-4 w-4" />
              Back to ops
            </Link>
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#577067]">Protocol fixture</p>
            <h1 className="mt-1 text-3xl font-semibold">Read-only scenario</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#577067]">
              Deterministic protocol state for quote, collateral, evidence, and watcher inspection.
            </p>
          </div>
          <button
            className="inline-flex h-11 items-center justify-center rounded-md bg-[#155e59] px-4 text-sm font-semibold text-white hover:bg-[#104d49] disabled:opacity-60"
            disabled={busy}
            onClick={refresh}
          >
            {busy ? "Refreshing..." : "Refresh scenario"}
          </button>
        </header>

        {error ? <Notice>{error}</Notice> : null}

        {payload ? (
          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-4">
              <Metric icon={<CheckCircle2 className="h-5 w-5" />} label="Funding" value={payload.summary.fundingStatus} detail={payload.summary.activationEligible ? "Activation eligible" : "Waiting"} />
              <Metric icon={<ShieldCheck className="h-5 w-5" />} label="Collateral" value={payload.summary.collateralObservationStatus} detail={payload.summary.collateralTemplateStatus.replaceAll("_", " ")} />
              <Metric icon={<Database className="h-5 w-5" />} label="Evidence" value={payload.summary.evidenceRecordStatus} detail={shortHash(payload.summary.evidenceCommitmentHash)} />
              <Metric icon={<CheckCircle2 className="h-5 w-5" />} label="Mode" value={payload.readOnly ? "Read-only" : "Review"} detail="No mutation controls" />
            </section>

            <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-lg border border-[#d8dfda] bg-white p-5">
                <h2 className="text-xl font-semibold">Scenario summary</h2>
                <div className="mt-4 space-y-2">
                  <Row label="Loan request" value={payload.summary.loanRequestId} />
                  <Row label="Pair" value={`${payload.summary.borrowAsset} / ${payload.summary.collateralAsset}`} />
                  <Row label="Suppliers" value={`${payload.summary.supplierCount}`} />
                  <Row label="Watcher statuses" value={payload.summary.disbursementObservationStatuses.join(", ")} />
                </div>
              </div>

              <div className="rounded-lg border border-[#d8dfda] bg-white p-5">
                <h2 className="text-xl font-semibold">Quote and fee state</h2>
                <div className="mt-4 space-y-2">
                  <Row label="Borrower APR" value={`${(payload.quote.borrowerAprBps / 100).toFixed(2)}%`} />
                  <Row label="Total due" value={payload.quote.totalDue.toString()} />
                  <Row label="Collateral with fee" value={`${payload.quote.collateralRequiredWithFee} ${payload.summary.collateralAsset}`} />
                  <Row label="Platform / reserve" value={`${payload.summary.platformFeeAmount} / ${payload.summary.arbiterReserveAmount}`} />
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-[#d8dfda] bg-white p-5">
              <h2 className="text-xl font-semibold">Inspection notes</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {payload.notes.map((note) => (
                  <div key={note} className="rounded-md bg-[#f7f9f8] p-3 text-sm text-[#42524c]">
                    {note}
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-[#c4d0c8] bg-white p-8 text-center text-[#6b7b74]">
            <p className="text-sm">Loading protocol scenario...</p>
          </div>
        )}
      </div>
    </main>
  );
}

function Metric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-[#d8dfda] bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-[#e3f4ef] text-[#155e59]">{icon}</div>
        <div>
          <p className="text-sm text-[#577067]">{label}</p>
          <p className="text-xl font-semibold capitalize">{value.replaceAll("_", " ")}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-[#6b7b74]">{detail}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-[#f7f9f8] px-3 py-2 text-sm">
      <span className="text-[#42524c]">{label}</span>
      <strong className="min-w-0 truncate text-right">{value}</strong>
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-[#ed6d47] bg-[#ffe8e5] p-4 text-sm text-[#8b2f22]">{children}</div>;
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}
