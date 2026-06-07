"use client";

import {
  Activity,
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
import { formatBps } from "@/lib/risk";
import type { Loan, MarketSnapshot, Quote } from "@/lib/types";

type DemoLoan = Loan & {
  riskLevel: "healthy" | "watch" | "warning" | "liquidation";
  escrowChecklist: string[];
};

type DemoPayload = {
  market: MarketSnapshot;
  loans: DemoLoan[];
};

export function BorrowFlow() {
  const [payload, setPayload] = useState<DemoPayload | null>(null);
  const [collateralDcr, setCollateralDcr] = useState(100);
  const [borrowAmount, setBorrowAmount] = useState(350);
  const [borrowAsset, setBorrowAsset] = useState<Loan["borrowAsset"]>("USDC");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch("/api/demo", { cache: "no-store" });
    const nextPayload = (await response.json()) as DemoPayload;
    setPayload(nextPayload);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh().catch(() => setNotice("Demo data could not load. Try refreshing the page."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const preview = quote ?? buildPreviewQuote(collateralDcr, borrowAmount, borrowAsset, payload?.market.dcrUsd ?? 12.13);
  const ltvPct = Math.min(preview.ltvBps / 100, 100);
  const activeLoans = payload?.loans.filter((loan) => ["funded", "active", "repayment_pending"].includes(loan.status)).length ?? 0;
  const marketReady = Boolean(payload && payload.market.sourceCount >= 2 && !payload.market.stale);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050b24] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(112,203,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(112,203,255,0.06)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="absolute inset-x-0 top-0 h-32 bg-[linear-gradient(rgba(112,203,255,0.10),transparent)]" />
        <div className="absolute left-[-14rem] top-[-12rem] h-[30rem] w-[30rem] rounded-full bg-[#2970ff]/30 blur-3xl" />
        <div className="absolute right-[-12rem] top-40 h-[28rem] w-[28rem] rounded-full bg-[#2ed6a1]/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
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
        </header>

        <section className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[0.88fr_1.12fr] lg:py-14">
          <div className="max-w-2xl">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#2ed6a1]/30 bg-[#2ed6a1]/10 px-3 py-1 text-sm font-medium text-[#9bf0d6]">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span className="truncate">Demo mode. No mainnet funds.</span>
            </div>
            <h1 className="mt-6 text-5xl font-semibold tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl">
              Borrow USDC. Keep your DCR.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/68">
              Post DCR collateral, review the terms, then move to the console for escrow steps. Real signing waits for simnet.
            </p>

            <div className="mt-8 rounded-2xl border border-[#70cbff]/15 bg-[#091440]/65 p-4 font-mono text-xs text-[#9bdfff] shadow-xl shadow-black/20" id="market">
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
          </div>

          <section id="borrow" className="min-w-0 rounded-[2rem] border border-[#70cbff]/20 bg-[#edf7f4] p-2 text-[#091440] shadow-2xl shadow-black/35 sm:p-3">
            <div className="overflow-hidden rounded-[1.5rem] border border-[#dbe7e2] bg-white">
              <div className="flex items-center justify-between border-b border-[#dbe7e2] bg-[#f7faf9] px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2970ff]">Borrow</p>
                  <h2 className="truncate text-2xl font-semibold tracking-[-0.04em]">DCR collateral loan</h2>
                </div>
                <div className="ml-3 shrink-0 rounded-full bg-[#e7f8f3] px-3 py-1 text-sm font-semibold text-[#118864]">Demo</div>
              </div>

              <div className="space-y-4 p-4 sm:p-5">
                <AssetAmountCard
                  label="Borrow"
                  value={borrowAmount}
                  onChange={setBorrowAmount}
                  asset={borrowAsset}
                  onAssetChange={setBorrowAsset}
                  help="Recommended: USDC"
                />
                <AssetAmountCard
                  label="Collateral"
                  value={collateralDcr}
                  onChange={setCollateralDcr}
                  asset="DCR"
                  help={payload ? `${currency(payload.market.dcrUsd)} per DCR` : "Loading DCR/USD"}
                />

                <div className="rounded-2xl border border-[#dbe7e2] bg-[#f7faf9] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#5f716a]">Loan-to-value</p>
                      <p className="text-3xl font-semibold tracking-[-0.04em]">{formatBps(preview.ltvBps)}</p>
                    </div>
                    <RiskBadge ltvBps={preview.ltvBps} />
                  </div>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#d9e4df]">
                    <div className={ltvBarClass(preview.ltvBps)} style={{ width: `${Math.min(ltvPct, 100)}%` }} />
                  </div>
                  <div className="mt-2 grid grid-cols-3 text-xs font-medium text-[#6b7b74]">
                    <span>0%</span>
                    <span className="text-center">35% target</span>
                    <span className="text-right">70% call</span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <MiniPanel label="Collateral" value={currency(preview.collateralUsd)} />
                  <MiniPanel label="Fee" value={currency(preview.originationFee)} />
                  <MiniPanel label="Max" value={currency(preview.maxBorrowAt35Ltv)} />
                </div>

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
                  <button
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#cddbd5] bg-white px-4 text-sm font-semibold text-[#091440] hover:bg-[#f7faf9] disabled:opacity-60"
                    disabled={busy === "quote"}
                    onClick={createQuote}
                  >
                    <Gauge className="h-4 w-4" />
                    {busy === "quote" ? "Pricing" : "Price quote"}
                  </button>
                  <button
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#2970ff] px-4 text-sm font-semibold text-white shadow-lg shadow-[#2970ff]/25 hover:bg-[#1d5fe8] disabled:opacity-60"
                    disabled={busy === "loan"}
                    onClick={createLoan}
                  >
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

function AssetAmountCard({
  label,
  value,
  onChange,
  asset,
  onAssetChange,
  help,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  asset: Loan["borrowAsset"] | "DCR";
  onAssetChange?: (value: Loan["borrowAsset"]) => void;
  help: string;
}) {
  return (
    <label className="block min-w-0 rounded-2xl border border-[#dbe7e2] bg-white p-4 shadow-sm">
      <span className="text-sm font-medium text-[#5f716a]">{label}</span>
      <div className="mt-2 flex min-w-0 items-center gap-3">
        <input
          className="min-w-0 flex-1 bg-transparent text-3xl font-semibold tracking-[-0.05em] outline-none sm:text-4xl"
          min="0"
          type="number"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {onAssetChange ? (
          <select
            className="h-11 shrink-0 rounded-full border border-[#cddbd5] bg-[#f7faf9] px-3 text-sm font-semibold"
            value={asset}
            onChange={(event) => onAssetChange(event.target.value as Loan["borrowAsset"])}
          >
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
  if (ltvBps >= 6000) return "h-3 rounded-full bg-[#ed6d47]";
  if (ltvBps >= 4500) return "h-3 rounded-full bg-[#f2b84b]";
  return "h-3 rounded-full bg-[#2ed6a1]";
}

function buildPreviewQuote(
  collateralDcr: number,
  borrowAmount: number,
  borrowAsset: Loan["borrowAsset"],
  dcrUsd: number,
): Quote {
  const collateralUsd = Number((collateralDcr * dcrUsd).toFixed(2));
  const ltvBps = collateralUsd > 0 ? Math.round((borrowAmount / collateralUsd) * 10000) : 0;
  const warnings: string[] = [];
  if (ltvBps > 3500) warnings.push("Above the 35% target LTV.");
  if (borrowAsset !== "USDC") warnings.push("USDC is the recommended demo asset.");

  return {
    collateralDcr,
    borrowAmount,
    borrowAsset,
    dcrUsd,
    collateralUsd,
    ltvBps,
    maxBorrowAt35Ltv: Number((collateralUsd * 0.35).toFixed(2)),
    liquidationThresholdBps: 7000,
    originationFee: Number((borrowAmount * 0.01).toFixed(2)),
    estimatedAprBps: 1450,
    warnings,
  };
}

function cleanWarning(warning: string): string {
  return warning
    .replace("This quote is above the 35% demo LTV target.", "Above the 35% target LTV.")
    .replace("USDC is the recommended demo borrow asset; other assets are roadmap items.", "USDC is the recommended demo asset.")
    .replace("Oracle health is degraded; keep this quote in demo mode until pricing is reviewed.", "Oracle needs review before real lending.");
}

function currency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}
