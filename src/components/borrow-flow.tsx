"use client";

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircuitBoard,
  Gauge,
  Landmark,
  LockKeyhole,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { ProtocolScenarioPanel, type DemoProtocolScenario } from "@/components/protocol-scenario-panel";
import {
  buildPreviewQuote,
  calculateBorrowFromLtv,
  calculateCollateralFromBorrow,
  calculateLtvBpsFromValues,
} from "@/lib/quote-math";
import { formatBps } from "@/lib/risk";
import type { Loan, MarketSnapshot, ProtocolQuoteSummary, Quote } from "@/lib/types";

type DemoLoan = Loan & {
  riskLevel: "healthy" | "watch" | "warning" | "liquidation";
  escrowChecklist: string[];
};

type DemoPayload = {
  market: MarketSnapshot;
  loans: DemoLoan[];
  protocolScenario?: DemoProtocolScenario;
};

const initialDcrUsd = 12.13;
const initialCollateralDcr = 100;
const initialBorrowAmount = 350;

export function BorrowFlow() {
  const [payload, setPayload] = useState<DemoPayload | null>(null);
  const [collateralDcr, setCollateralDcr] = useState(initialCollateralDcr);
  const [borrowAmount, setBorrowAmount] = useState(initialBorrowAmount);
  const [targetLtvBps, setTargetLtvBps] = useState(
    calculateLtvBpsFromValues(initialBorrowAmount, initialCollateralDcr, initialDcrUsd),
  );
  const [borrowAsset, setBorrowAsset] = useState<Loan["borrowAsset"]>("USDC");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const dcrUsd = payload?.market.dcrUsd ?? initialDcrUsd;

  async function refresh() {
    const response = await fetch("/api/demo", { cache: "no-store" });
    const nextPayload = (await response.json()) as DemoPayload;
    setPayload(nextPayload);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh().catch(() => setNotice("Demo data could not load. Try refreshing the page."));
  }, []);

  function clearLiveQuote() {
    setQuote(null);
    setNotice(null);
  }

  function updateBorrowAmount(value: number) {
    const nextBorrowAmount = safeNumber(value);
    setBorrowAmount(nextBorrowAmount);
    setTargetLtvBps(calculateLtvBpsFromValues(nextBorrowAmount, collateralDcr, dcrUsd));
    clearLiveQuote();
  }

  function updateCollateralDcr(value: number) {
    const nextCollateralDcr = safeNumber(value);
    setCollateralDcr(nextCollateralDcr);
    setTargetLtvBps(calculateLtvBpsFromValues(borrowAmount, nextCollateralDcr, dcrUsd));
    clearLiveQuote();
  }

  function updateBorrowAsset(value: Loan["borrowAsset"]) {
    setBorrowAsset(value);
    clearLiveQuote();
  }

  function updateLtv(value: number) {
    const nextLtvBps = Math.max(0, Math.min(7000, Math.round(value)));
    setTargetLtvBps(nextLtvBps);
    setBorrowAmount(calculateBorrowFromLtv(collateralDcr, dcrUsd, nextLtvBps));
    clearLiveQuote();
  }

  function updateCollateralForCurrentBorrow() {
    const nextCollateral = calculateCollateralFromBorrow(borrowAmount, dcrUsd, targetLtvBps || 3500);
    setCollateralDcr(nextCollateral);
    clearLiveQuote();
  }

  async function createQuote() {
    setBusy("quote");
    setNotice(null);
    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collateralDcr, borrowAmount, borrowAsset }),
      });
      const nextQuote = await response.json();
      if (!response.ok) throw new Error(nextQuote.error);
      setQuote(nextQuote);
      setTargetLtvBps(nextQuote.ltvBps);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Quote failed.");
    } finally {
      setBusy(null);
    }
  }

  async function createLoan() {
    setBusy("loan");
    setNotice(null);
    try {
      const response = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collateralDcr, borrowAmount, borrowAsset }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setNotice(`${result.loan.ref} created. Open Console for the collateral flow.`);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Loan creation failed.");
    } finally {
      setBusy(null);
    }
  }

  const preview = quote ?? buildPreviewQuote({ collateralDcr, borrowAmount, borrowAsset, dcrUsd });
  const activeLoans = payload?.loans.filter((loan) => ["funded", "active", "repayment_pending"].includes(loan.status)).length ?? 0;
  const marketReady = Boolean(payload && payload.market.sourceCount >= 2 && !payload.market.stale);
  const monthlyInterest = Number((preview.borrowAmount * (preview.estimatedAprBps / 10000 / 12)).toFixed(2));
  const estimatedPayoff = Number((preview.borrowAmount + monthlyInterest + preview.originationFee).toFixed(2));
  const quoteMode = quote ? "Live quote" : "Preview";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050b24] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(112,203,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(112,203,255,0.06)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="absolute inset-x-0 top-0 h-32 bg-[linear-gradient(rgba(112,203,255,0.10),transparent)]" />
        <div className="absolute left-[-14rem] top-[-12rem] h-[30rem] w-[30rem] rounded-full bg-[#2970ff]/30 blur-3xl" />
        <div className="absolute right-[-12rem] top-40 h-[28rem] w-[28rem] rounded-full bg-[#2ed6a1]/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 rounded-2xl border border-[#70cbff]/15 bg-[#091440]/70 px-4 py-3 shadow-2xl shadow-black/25 backdrop-blur md:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#2970ff] shadow-lg shadow-[#2970ff]/30">
              <Landmark className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase tracking-[0.22em] text-[#70cbff]">Decred Capital</p>
              <p className="truncate text-sm text-white/70">DCR-backed credit desk</p>
            </div>
          </div>
          <nav className="hidden items-center gap-2 text-sm text-white/70 md:flex">
            <a className="rounded-full px-3 py-2 hover:bg-white/10 hover:text-white" href="#borrow">Borrow</a>
            <a className="rounded-full px-3 py-2 hover:bg-white/10 hover:text-white" href="#market">Market</a>
            <Link className="rounded-full px-3 py-2 hover:bg-white/10 hover:text-white" href="/ops">Ops</Link>
            <Link className="rounded-full bg-white px-4 py-2 font-semibold text-[#091440]" href="/console">Console</Link>
          </nav>
          <Link className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-[#091440] md:hidden" href="/console">
            Console
          </Link>
        </header>

        <section className="grid flex-1 items-start gap-8 pt-7 pb-8 lg:grid-cols-[0.88fr_1.12fr] lg:pt-10">
          <div className="max-w-2xl pt-2 lg:pt-28 xl:pt-32">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#2ed6a1]/30 bg-[#2ed6a1]/10 px-3 py-1 text-sm font-medium text-[#9bf0d6]">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span className="truncate">Demo mode. No mainnet funds.</span>
            </div>
            <h1 className="mt-5 text-5xl font-semibold tracking-[-0.06em] text-white sm:text-6xl lg:text-6xl xl:text-7xl">
              Borrow USDC. Keep your DCR.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-white/68">
              Pick a target LTV, adjust either field, and review the loan math before escrow steps begin.
            </p>

            <div className="mt-7 rounded-2xl border border-[#70cbff]/15 bg-[#091440]/65 p-4 font-mono text-xs text-[#9bdfff] shadow-xl shadow-black/20" id="market">
              <div className="flex items-center gap-2 border-b border-[#70cbff]/10 pb-3 text-[#2ed6a1]">
                <Terminal className="h-4 w-4" />
                <span>desk://decred/capital-access</span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <TerminalStat label="DCR/USD" value={payload ? currency(payload.market.dcrUsd) : "..."} detail={`${payload?.market.sourceCount ?? 0} feeds`} ok={marketReady} />
                <TerminalStat label="loans" value={`${payload?.loans.length ?? "..."}`} detail={`${activeLoans} active`} ok />
                <TerminalStat label="escrow" value="2-of-3" detail="preview" ok />
              </div>
            </div>
            <ProtocolScenarioPanel scenario={payload?.protocolScenario} />
          </div>

          <section id="borrow" className="min-w-0 rounded-[2rem] border border-[#70cbff]/20 bg-[#edf7f4] p-2 text-[#091440] shadow-2xl shadow-black/35 sm:p-3 lg:self-start">
            <div className="overflow-hidden rounded-[1.5rem] border border-[#dbe7e2] bg-white">
              <div className="flex items-center justify-between border-b border-[#dbe7e2] bg-[#f7faf9] px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2970ff]">{quoteMode}</p>
                  <h2 className="truncate text-2xl font-semibold tracking-[-0.04em]">DCR collateral loan</h2>
                </div>
                <div className="ml-3 shrink-0 rounded-full bg-[#e7f8f3] px-3 py-1 text-sm font-semibold text-[#118864]">Demo</div>
              </div>

              <div className="space-y-4 p-4 sm:p-5">
                <AssetAmountCard label="Borrow" value={borrowAmount} onChange={updateBorrowAmount} asset={borrowAsset} onAssetChange={updateBorrowAsset} help="Tap the amount to type a value, or use the LTV slider below." />
                <AssetAmountCard label="Collateral" value={collateralDcr} onChange={updateCollateralDcr} asset="DCR" help={payload ? `Tap the DCR amount to edit. ${currency(payload.market.dcrUsd)} per DCR.` : "Tap the DCR amount to edit. Loading DCR/USD."} />
                <LtvMeter quote={preview} targetLtvBps={targetLtvBps} onChange={updateLtv} onSetCollateral={updateCollateralForCurrentBorrow} />

                <div className="grid gap-3 sm:grid-cols-3">
                  <MiniPanel label="Collateral" value={currency(preview.collateralUsd)} />
                  <MiniPanel label="Fee" value={currency(preview.originationFee)} />
                  <MiniPanel label="Max" value={currency(preview.maxBorrowAt35Ltv)} />
                </div>

                <div className="rounded-2xl border border-[#dbe7e2] bg-[#f7faf9] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#42524c]">Loan summary</p>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#2970ff]">30-day demo</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    <SummaryRow label="Principal" value={`${currency(preview.borrowAmount)} ${preview.borrowAsset}`} />
                    <SummaryRow label="Est. interest" value={currency(monthlyInterest)} />
                    <SummaryRow label="Platform fee" value={currency(preview.originationFee)} />
                    <SummaryRow label="Payoff" value={`${currency(estimatedPayoff)} ${preview.borrowAsset}`} strong />
                  </div>
                </div>

                <ProtocolQuotePanel protocolQuote={preview.protocolQuote} borrowAsset={preview.borrowAsset} />

                <div className="grid gap-2">
                  {preview.warnings.length ? (
                    preview.warnings.slice(0, 2).map((warning) => <InlineWarning key={warning}>{cleanWarning(warning)}</InlineWarning>)
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl bg-[#e7f8f3] px-3 py-2 text-sm font-medium text-[#118864]">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>Inside demo guardrails.</span>
                    </div>
                  )}
                  {notice ? <InlineWarning>{notice}</InlineWarning> : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
                  <button className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#cddbd5] bg-white px-4 text-sm font-semibold text-[#091440] hover:bg-[#f7faf9] disabled:opacity-60" disabled={busy === "quote"} onClick={createQuote}>
                    <Gauge className="h-4 w-4" />
                    {busy === "quote" ? "Pricing" : "Refresh quote"}
                  </button>
                  <button className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#2970ff] px-4 text-sm font-semibold text-white shadow-lg shadow-[#2970ff]/25 hover:bg-[#1d5fe8] disabled:opacity-60" disabled={busy === "loan"} onClick={createLoan}>
                    {busy === "loan" ? "Creating" : "Create loan"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 p-3 sm:grid-cols-3">
              <TrustItem icon={LockKeyhole} label="Escrow" text="2-of-3" />
              <TrustItem icon={BarChart3} label="Oracle" text="blended" />
              <TrustItem icon={CircuitBoard} label="Simnet" text="next" />
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function AssetAmountCard({ label, value, onChange, asset, onAssetChange, help }: { label: string; value: number; onChange: (value: number) => void; asset: Loan["borrowAsset"] | "DCR"; onAssetChange?: (value: Loan["borrowAsset"]) => void; help: string }) {
  return (
    <label className="block min-w-0 rounded-2xl border border-[#dbe7e2] bg-white p-4 shadow-sm">
      <span className="text-sm font-medium text-[#5f716a]">{label}</span>
      <div className="mt-2 flex min-w-0 items-center gap-3">
        <input aria-label={`${label} amount`} className="min-w-0 flex-1 bg-transparent text-3xl font-semibold tracking-[-0.05em] outline-none sm:text-4xl" min="0" type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
        {onAssetChange ? (
          <select className="h-11 shrink-0 rounded-full border border-[#cddbd5] bg-[#f7faf9] px-3 text-sm font-semibold" value={asset} onChange={(event) => onAssetChange(event.target.value as Loan["borrowAsset"])}>
            <option>USDC</option>
            <option>USDT</option>
            <option>BTC</option>
          </select>
        ) : (
          <span className="shrink-0 rounded-full border border-[#cddbd5] bg-[#f7faf9] px-4 py-2 text-sm font-semibold">{asset}</span>
        )}
      </div>
      <span className="mt-2 block truncate text-xs text-[#6b7b74]">{help}</span>
    </label>
  );
}

function LtvMeter({ quote, targetLtvBps, onChange, onSetCollateral }: { quote: Quote; targetLtvBps: number; onChange: (value: number) => void; onSetCollateral: () => void }) {
  const ltvPercent = Math.min(quote.ltvBps / 100, 100);
  return (
    <div className="rounded-2xl border border-[#dbe7e2] bg-[#f7faf9] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#5f716a]">Loan-to-value</p>
          <p className="text-3xl font-semibold tracking-[-0.04em]">{formatBps(quote.ltvBps)}</p>
        </div>
        <RiskBadge ltvBps={quote.ltvBps} />
      </div>
      <div className="mt-5">
        <input
          aria-label="Loan-to-value"
          className="h-2 w-full cursor-pointer accent-[#2970ff]"
          max="7000"
          min="0"
          onChange={(event) => onChange(Number(event.target.value))}
          step="50"
          type="range"
          value={Math.min(targetLtvBps, 7000)}
        />
        <div className="relative mt-4 h-4 overflow-hidden rounded-full bg-[#d9e4df]">
          <div className="absolute inset-y-0 left-[50%] w-px bg-white/80" />
          <div className="absolute inset-y-0 left-[77%] w-px bg-white/80" />
          <div className={ltvBarClass(quote.ltvBps)} style={{ width: `${ltvPercent}%` }} />
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 text-xs font-medium text-[#6b7b74]">
        <span>0%</span>
        <span className="text-center">35% target</span>
        <span className="text-right">70% call</span>
      </div>
      <button
        className="mt-3 inline-flex h-9 items-center gap-2 rounded-full border border-[#2970ff]/35 bg-[#eef4ff] px-3 text-xs font-semibold text-[#2970ff] shadow-sm transition hover:border-[#2970ff] hover:bg-white hover:text-[#1d5fe8]"
        onClick={onSetCollateral}
        type="button"
      >
        <span className="relative h-4 w-7 rounded-full bg-[#2970ff]/20">
          <span className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-[#2970ff] shadow-sm" />
        </span>
        Adjust DCR collateral
      </button>
    </div>
  );
}

function ProtocolQuotePanel({ protocolQuote, borrowAsset }: { protocolQuote?: ProtocolQuoteSummary; borrowAsset: Loan["borrowAsset"] }) {
  if (!protocolQuote) {
    return (
      <div className="rounded-2xl border border-[#dbe7e2] bg-[#f7faf9] p-4 text-sm text-[#42524c]">
        <p className="font-semibold text-[#091440]">Protocol quote</p>
        <p className="mt-2">Refresh quote to attach supplier funding, platform fee, and next-step protocol guidance.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#cde6dc] bg-[#eefbf6] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#118864]">Protocol quote</p>
          <p className="mt-1 text-xs text-[#5f716a]">Supplier-backed borrower pricing</p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#118864]">{protocolQuote.fundingStatus}</span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <ProtocolMetric label="APR" value={formatBps(protocolQuote.borrowerAprBps)} />
        <ProtocolMetric label="Supplier fill" value={`${protocolQuote.supplierFilledAmount} ${borrowAsset}`} />
        <ProtocolMetric label="DCR fee" value={`${protocolQuote.platformFeeDcr} DCR`} />
        <ProtocolMetric label="Collateral required" value={`${protocolQuote.collateralRequiredWithFeeDcr} DCR`} />
      </div>
      <div className="mt-4 space-y-2">
        <SummaryRow label="Weighted supplier APR" value={formatBps(protocolQuote.weightedSupplierAprBps)} />
        <SummaryRow label="Funding progress" value={formatBps(protocolQuote.fundingProgressBps)} />
        <SummaryRow label="Arbiter reserve" value={`${protocolQuote.arbiterReserveDcr} DCR`} />
        <SummaryRow label="Next build step" value={protocolQuote.nextBuildStep} />
      </div>
      <div className="mt-4 rounded-xl bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7b74]">Supplier fills</p>
        <div className="mt-3 space-y-2">
          {protocolQuote.supplierFills.map((fill) => (
            <div key={fill.fillId} className="rounded-lg bg-[#f7faf9] p-3 text-xs text-[#42524c]">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-[#091440]">{fill.supplierId}</span>
                <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-[#118864]">{fill.status}</span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <span>{fill.amount} {borrowAsset}</span>
                <span>{formatBps(fill.aprBps)} APR</span>
                <span>{formatBps(fill.fundingShareBps)} share</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {protocolQuote.notes.slice(0, 2).map((note) => (
          <div key={note} className="rounded-xl bg-white px-3 py-2 text-xs text-[#42524c]">
            {note}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProtocolMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="truncate text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#6b7b74]">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[#091440]">{value}</p>
    </div>
  );
}

function TerminalStat({ label, value, detail, ok }: { label: string; value: string; detail: string; ok: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border border-[#70cbff]/10 bg-black/20 p-3">
      <p className="truncate text-[0.65rem] uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className={ok ? "mt-2 truncate text-xl font-semibold text-[#9bf0d6]" : "mt-2 truncate text-xl font-semibold text-[#ffd88a]"}>{value}</p>
      <p className="mt-1 truncate text-white/45">{detail}</p>
    </div>
  );
}

function MiniPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[#dbe7e2] bg-white p-3">
      <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7b74]">{label}</p>
      <p className="mt-1 truncate text-base font-semibold sm:text-lg">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[#5f716a]">{label}</span>
      <span className={strong ? "truncate text-base font-semibold text-[#091440]" : "truncate font-medium text-[#091440]"}>{value}</span>
    </div>
  );
}

function InlineWarning({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 rounded-xl bg-[#fff4d8] px-3 py-2 text-sm text-[#6f4d00]">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

function RiskBadge({ ltvBps }: { ltvBps: number }) {
  const label = ltvBps >= 7000 ? "Liquidation" : ltvBps >= 6000 ? "Warning" : ltvBps >= 4500 ? "Watch" : "Healthy";
  const className = ltvBps >= 6000 ? "bg-[#ffe8e5] text-[#a23b2a]" : ltvBps >= 4500 ? "bg-[#fff4d8] text-[#855d00]" : "bg-[#e7f8f3] text-[#118864]";
  return <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${className}`}>{label}</span>;
}

function TrustItem({ icon: Icon, label, text }: { icon: ComponentType<{ className?: string }>; label: string; text: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/40 bg-white/70 p-3 text-[#091440]">
      <Icon className="h-4 w-4 text-[#2970ff]" />
      <p className="mt-2 truncate text-sm font-semibold">{label}</p>
      <p className="truncate text-xs text-[#5f716a]">{text}</p>
    </div>
  );
}

function ltvBarClass(ltvBps: number): string {
  if (ltvBps >= 6000) return "h-4 rounded-full bg-[#ed6d47]";
  if (ltvBps >= 4500) return "h-4 rounded-full bg-[#f2b84b]";
  return "h-4 rounded-full bg-[#2ed6a1]";
}

function cleanWarning(warning: string): string {
  return warning
    .replace("This quote is above the 35% demo LTV target.", "Above the 35% target LTV.")
    .replace("USDC is the recommended demo borrow asset; other assets are roadmap items.", "USDC is the recommended demo asset.")
    .replace("Oracle health is degraded; keep this quote in demo mode until pricing is reviewed.", "Oracle needs review before real lending.");
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

function currency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}
