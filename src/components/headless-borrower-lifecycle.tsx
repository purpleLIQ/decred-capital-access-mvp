"use client";

import { ArrowRight, Landmark, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { buildPreviewQuote, calculateLtvBpsFromValues } from "@/lib/quote-math";
import { formatBps } from "@/lib/risk";
import type { HeadlessLoanLifecycleRecord } from "@/lib/headless-loan-lifecycle";
import type { Loan, Quote } from "@/lib/types";

const initialDcrUsd = 12.13;
const initialCollateralDcr = 100;
const initialBorrowAmount = 350;

export function HeadlessBorrowerLifecycle() {
  const [collateralDcr, setCollateralDcr] = useState(initialCollateralDcr);
  const [borrowAmount, setBorrowAmount] = useState(initialBorrowAmount);
  const [borrowAsset, setBorrowAsset] = useState<Loan["borrowAsset"]>("USDC");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [borrowerContact, setBorrowerContact] = useState("");
  const [acceptedRecord, setAcceptedRecord] = useState<HeadlessLoanLifecycleRecord | null>(null);
  const [lookupCode, setLookupCode] = useState("");
  const [lookupResult, setLookupResult] = useState<HeadlessLoanLifecycleRecord | null>(null);
  const [lookupSearched, setLookupSearched] = useState(false);

  const preview = quote ?? buildPreviewQuote({ collateralDcr, borrowAmount, borrowAsset, dcrUsd: initialDcrUsd });
  const ltvBps = calculateLtvBpsFromValues(borrowAmount, collateralDcr, initialDcrUsd);
  const estimatedPayoff = Number((preview.borrowAmount + preview.originationFee + preview.borrowAmount * (preview.estimatedAprBps / 10000 / 12)).toFixed(2));

  async function refreshQuote() {
    setBusy("quote");
    setNotice(null);
    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collateralDcr, borrowAmount, borrowAsset }),
      });
      const data = (await response.json()) as Quote & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Quote failed.");
      setQuote(data);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Quote failed.");
    } finally {
      setBusy(null);
    }
  }

  async function acceptQuote() {
    setBusy("accept");
    setNotice(null);
    try {
      const response = await fetch("/api/headless-loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collateralDcr,
          borrowAmount,
          borrowAsset,
          borrowerContact: borrowerContact.trim()
            ? { preference: "email", value: borrowerContact.trim(), consentForUpdates: true }
            : undefined,
          repaymentAmount: estimatedPayoff,
          requestedAmountUsd: borrowAsset === "BTC" ? undefined : borrowAmount,
        }),
      });
      const data = (await response.json()) as { record?: HeadlessLoanLifecycleRecord; error?: string };
      if (!response.ok || !data.record) throw new Error(data.error ?? "Could not save lifecycle record.");
      setAcceptedRecord(data.record);
      setLookupCode(data.record.lookupCode);
      setLookupResult(data.record);
      setLookupSearched(true);
      setNotice(`${data.record.publicLoanReference} saved. Use this reference to return without an account.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save lifecycle record.");
    } finally {
      setBusy(null);
    }
  }

  async function saveOptionalContact(skip = false) {
    if (!acceptedRecord) return;
    setBusy("contact");
    setNotice(null);
    try {
      const response = await fetch("/api/headless-loans/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lookupCode: acceptedRecord.lookupCode,
          borrowerContact: skip || !borrowerContact.trim()
            ? { preference: "none", consentForUpdates: false }
            : { preference: "email", value: borrowerContact.trim(), consentForUpdates: true },
        }),
      });
      const data = (await response.json()) as { record?: HeadlessLoanLifecycleRecord; error?: string };
      if (!response.ok || !data.record) throw new Error(data.error ?? "Could not update contact preference.");
      setAcceptedRecord(data.record);
      setLookupResult(data.record);
      setNotice(skip || !borrowerContact.trim() ? "Continuing without contact info. Lookup code remains the recovery path." : "Optional contact saved for updates/recovery.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update contact preference.");
    } finally {
      setBusy(null);
    }
  }

  async function lookupLoan() {
    if (!lookupCode.trim()) {
      setLookupResult(null);
      setLookupSearched(false);
      setNotice("Enter a public loan reference to look up status.");
      return;
    }

    setBusy("lookup");
    setNotice(null);
    try {
      const response = await fetch(`/api/headless-loans?lookupCode=${encodeURIComponent(lookupCode.trim())}`, { cache: "no-store" });
      const data = (await response.json()) as { record?: HeadlessLoanLifecycleRecord | null; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Lookup failed.");
      setLookupResult(data.record ?? null);
      setLookupSearched(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Lookup failed.");
    } finally {
      setBusy(null);
    }
  }

  function resetQuoteState() {
    setQuote(null);
    setAcceptedRecord(null);
    setLookupResult(null);
    setLookupSearched(false);
  }

  return (
    <main className="min-h-screen bg-[#091440] text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 rounded-2xl border border-[#70cbff]/20 bg-[#0c1d55]/80 px-4 py-3 shadow-2xl shadow-black/25">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#2970ff]"><Landmark className="h-5 w-5" /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#70cbff]">Decred Capital</p>
              <p className="text-sm text-white/70">Accountless borrower lifecycle</p>
            </div>
          </div>
          <nav className="flex items-center gap-2 text-sm text-white/70">
            <Link className="rounded-full px-3 py-2 hover:bg-white/10" href="/ops/lifecycles">Lifecycle ops</Link>
            <Link className="rounded-full bg-white px-4 py-2 font-semibold text-[#091440]" href="/ops">Ops</Link>
          </nav>
        </header>

        <section className="grid flex-1 items-start gap-8 py-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="pt-6 lg:pt-20">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#2ED6A1]/30 bg-[#2ED6A1]/10 px-3 py-1 text-sm font-medium text-[#9bf0d6]"><ShieldCheck className="h-4 w-4" />No login, no mainnet execution</div>
            <h1 className="mt-5 max-w-2xl text-5xl font-semibold tracking-[-0.06em] sm:text-6xl">Quote. Accept. Save your loan reference.</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-white/68">Borrowers can accept a quote, optionally leave contact info for updates/recovery, and return later with a public lookup code.</p>
            <LifecycleTimeline />
          </div>

          <div className="space-y-4 rounded-[2rem] border border-[#70cbff]/20 bg-[#0c1d55]/80 p-3 shadow-2xl shadow-black/35">
            <section className="rounded-[1.5rem] border border-[#70cbff]/20 bg-[#edf7f4] p-4 text-[#091440]">
              <div className="grid gap-3 sm:grid-cols-2">
                <AmountInput label="Borrow" asset={borrowAsset} value={borrowAmount} onChange={(value) => { setBorrowAmount(value); resetQuoteState(); }} onAssetChange={(asset) => { setBorrowAsset(asset); resetQuoteState(); }} />
                <AmountInput label="Collateral" asset="DCR" value={collateralDcr} onChange={(value) => { setCollateralDcr(value); resetQuoteState(); }} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <MetricCard label="LTV" value={formatBps(ltvBps)} />
                <MetricCard label="APR" value={formatBps(preview.estimatedAprBps)} />
                <MetricCard label="Fee" value={currency(preview.originationFee)} />
                <MetricCard label="Payoff" value={currency(estimatedPayoff)} />
              </div>
              <ActionPanel
                primaryAction={refreshQuote}
                primaryBusy={busy === "quote"}
                primaryLabel="Refresh quote"
                secondaryAction={acceptQuote}
                secondaryBusy={busy === "accept"}
                secondaryDisabled={!preview.protocolQuote}
                secondaryLabel="Accept and save"
              />
              <p className="mt-3 text-xs text-[#5f716a]">Refresh quote first so supplier fills are attached. Accepting saves a lifecycle record through the store boundary.</p>
            </section>

            <section className="rounded-[1.5rem] border border-[#70cbff]/20 bg-[#edf7f4] p-4 text-[#091440]">
              <h2 className="text-lg font-semibold">Optional contact</h2>
              <p className="mt-1 text-sm text-[#5f716a]">Used only for updates or recovery. This is not an account and is not shown in public/evidence fields.</p>
              {acceptedRecord ? <LoanReferenceCard record={acceptedRecord} /> : null}
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <input className="h-11 rounded-xl border border-[#cddbd5] px-3 outline-none focus:border-[#2970ff]" onChange={(event) => setBorrowerContact(event.target.value)} placeholder="optional email" type="email" value={borrowerContact} />
                <button className="h-11 rounded-xl border border-[#cddbd5] bg-white px-4 text-sm font-semibold" disabled={!acceptedRecord || busy === "contact"} onClick={() => saveOptionalContact(true)}>Skip contact</button>
                <button className="h-11 rounded-xl bg-[#2970ff] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={!acceptedRecord || busy === "contact"} onClick={() => saveOptionalContact(false)}>Save contact</button>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-[#70cbff]/20 bg-[#edf7f4] p-4 text-[#091440]">
              <h2 className="text-lg font-semibold">Loan lookup</h2>
              <p className="mt-1 text-sm text-[#5f716a]">Enter the public loan reference. No borrower login required.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input className="h-11 rounded-xl border border-[#cddbd5] px-3 font-mono uppercase outline-none focus:border-[#2970ff]" onChange={(event) => setLookupCode(event.target.value)} placeholder="DCL-..." value={lookupCode} />
                <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#091440] px-4 text-sm font-semibold text-white" disabled={busy === "lookup"} onClick={lookupLoan}><Search className="h-4 w-4" />Lookup</button>
              </div>
              {lookupResult ? <LookupResult record={lookupResult} /> : lookupSearched ? <div className="mt-3 rounded-xl bg-[#fff4d8] p-3 text-sm text-[#6f4d00]">Loan reference not found.</div> : null}
            </section>
            {notice ? <div className="rounded-xl border border-[#70cbff]/20 bg-[#0c1d55] p-3 text-sm text-[#70cbff]">{notice}</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function LoanReferenceCard({ record }: { record: HeadlessLoanLifecycleRecord }) {
  return (
    <div className="mt-3 rounded-xl border border-[#2970ff]/20 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#2970ff]">Public loan reference</p>
      <p className="mt-1 break-all font-mono text-xl font-semibold text-[#091440]">{record.publicLoanReference}</p>
      <p className="mt-1 text-xs text-[#5f716a]">This lookup code is the borrower recovery path.</p>
    </div>
  );
}

function LookupResult({ record }: { record: HeadlessLoanLifecycleRecord }) {
  return (
    <div className="mt-4 space-y-3 rounded-xl bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono font-semibold">{record.publicLoanReference}</span><StatusBadge label={record.lifecycleStatus} /></div>
      <div className="grid gap-2 sm:grid-cols-3">
        <MetricCard label="Supplier positions" value={`${record.supplierPositions.length}`} />
        <MetricCard label="Repayment due" value={formatAssetAmount(record.repaymentAllocationPreview.totalDue, record.borrowAsset)} />
        <MetricCard label="Remaining" value={formatAssetAmount(record.repaymentAllocationPreview.remainingDue, record.borrowAsset)} />
      </div>
      <div className="space-y-2">
        <SummaryRow label="Next borrower action" value={record.nextBorrowerAction} />
        <SummaryRow label="Operator action" value={record.nextSupplierOperatorAction} />
        <SummaryRow label="Collateral lock" value={record.collateralLock.status} />
        <SummaryRow label="Fee output" value={record.dcrPlatformFeeOutput.status} />
        <SummaryRow label="Disbursement" value={record.supplierDisbursement.status} />
        <SummaryRow label="Repayment detection" value={record.repaymentDetection.status} />
        <SummaryRow label="Arbiter review" value={record.arbiterReview.status} />
        <SummaryRow label="Evidence" value={record.evidenceBundle.status} />
        <SummaryRow label="Evidence timestamp" value={record.evidenceBundle.timestamp.status} />
        <SummaryRow label="Funding route" value={record.fundingRoute.status} />
      </div>
    </div>
  );
}

function LifecycleTimeline() {
  const steps = ["quote", "accept", "optional contact", "loan reference", "lookup", "repayment"];
  return <div className="mt-6 grid gap-2 sm:grid-cols-3">{steps.map((step) => <div key={step} className="rounded-xl border border-[#70cbff]/15 bg-[#0c1d55] px-3 py-2 text-sm text-[#70cbff]">{step}</div>)}</div>;
}

function AmountInput({ label, asset, value, onChange, onAssetChange }: { label: string; asset: Loan["borrowAsset"] | "DCR"; value: number; onChange: (value: number) => void; onAssetChange?: (asset: Loan["borrowAsset"]) => void }) {
  return (
    <label className="block rounded-xl bg-white p-3">
      <span className="text-sm font-medium text-[#5f716a]">{label}</span>
      <div className="mt-2 flex items-center gap-2">
        <input className="min-w-0 flex-1 bg-transparent text-3xl font-semibold outline-none" min="0" onChange={(event) => onChange(Number(event.target.value))} type="number" value={value} />
        {onAssetChange ? <select className="h-10 rounded-full border border-[#cddbd5] px-3" onChange={(event) => onAssetChange(event.target.value as Loan["borrowAsset"])} value={asset}><option>USDC</option><option>USDT</option><option>BTC</option></select> : <span className="rounded-full border border-[#cddbd5] px-3 py-2 text-sm font-semibold">{asset}</span>}
      </div>
    </label>
  );
}

function ActionPanel({ primaryAction, primaryBusy, primaryLabel, secondaryAction, secondaryBusy, secondaryDisabled, secondaryLabel }: { primaryAction: () => void; primaryBusy: boolean; primaryLabel: string; secondaryAction: () => void; secondaryBusy: boolean; secondaryDisabled: boolean; secondaryLabel: string }) {
  return <div className="mt-4 grid gap-2 sm:grid-cols-2"><button className="h-12 rounded-xl border border-[#cddbd5] bg-white px-4 text-sm font-semibold" disabled={primaryBusy} onClick={primaryAction}>{primaryBusy ? "Working" : primaryLabel}</button><button className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#2970ff] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={secondaryBusy || secondaryDisabled} onClick={secondaryAction}>{secondaryBusy ? "Saving" : secondaryLabel}<ArrowRight className="h-4 w-4" /></button></div>;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white p-3"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7b74]">{label}</p><p className="mt-1 truncate font-semibold text-[#091440]">{value}</p></div>;
}

function StatusBadge({ label }: { label: string }) {
  return <span className="rounded-full bg-[#e7f8f3] px-2.5 py-1 text-xs font-semibold text-[#41bf53]">{label}</span>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><span className="text-[#5f716a]">{label}</span><span className="truncate font-medium text-[#091440]">{value}</span></div>;
}

function currency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function formatAssetAmount(amount: number, asset: Loan["borrowAsset"]): string {
  return `${amount.toLocaleString("en-US", { maximumFractionDigits: asset === "BTC" ? 8 : 2 })} ${asset}`;
}
