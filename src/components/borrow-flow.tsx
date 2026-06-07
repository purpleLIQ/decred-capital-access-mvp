"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Gauge,
  Landmark,
  LockKeyhole,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
    void refresh().catch(() => setNotice("Demo data could not load. Try refreshing the page."));
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
      setNotice(`Created ${result.loan.ref}. Open the console to continue the simulated collateral flow.`);
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
  const healthTone = payload && payload.market.sourceCount >= 2 && !payload.market.stale ? "good" : "warning";

  return (
    <main className="min-h-screen overflow-hidden bg-[#061033] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute left-[-12rem] top-[-10rem] h-96 w-96 rounded-full bg-[#2970ff]/30 blur-3xl" />
        <div className="absolute right-[-10rem] top-32 h-96 w-96 rounded-full bg-[#2ed6a1]/20 blur-3xl" />
        <div className="absolute bottom-[-16rem] left-1/2 h-[28rem] w-[28rem] rounded-full bg-[#70cbff]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur md:px-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#2970ff] shadow-lg shadow-[#2970ff]/30">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#70cbff]">Decred Capital Access</p>
              <p className="text-sm text-white/70">Borrow without selling DCR</p>
            </div>
          </div>
          <nav className="hidden items-center gap-2 text-sm text-white/70 md:flex">
            <a className="rounded-full px-3 py-2 hover:bg-white/10 hover:text-white" href="#borrow">Borrow</a>
            <a className="rounded-full px-3 py-2 hover:bg-white/10 hover:text-white" href="#market">Market</a>
            <Link className="rounded-full px-3 py-2 hover:bg-white/10 hover:text-white" href="/ops">Ops</Link>
            <Link className="rounded-full bg-white px-4 py-2 font-semibold text-[#091440]" href="/console">Console</Link>
          </nav>
        </header>

        <section className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[0.92fr_1.08fr] lg:py-16">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#2ed6a1]/30 bg-[#2ed6a1]/10 px-3 py-1 text-sm font-medium text-[#9bf0d6]">
              <ShieldCheck className="h-4 w-4" />
              Demo mode · no mainnet funds or private keys
            </div>
            <h1 className="mt-6 text-5xl font-semibold tracking-[-0.05em] text-white sm:text-6xl lg:text-7xl">
              Get liquidity from your DCR without selling it.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/68">
              A Decred-native lending prototype with transparent loan math, simulated 2-of-3 escrow, blended price checks, and operator review before any real-world rollout.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3" id="market">
              <HeroStat label="DCR/USD" value={payload ? currency(payload.market.dcrUsd) : "..."} detail={`${payload?.market.sourceCount ?? 0} sources`} tone={healthTone} />
              <HeroStat label="Open demo loans" value={`${payload?.loans.length ?? "..."}`} detail={`${activeLoans} active`} tone="neutral" />
              <HeroStat label="Custody model" value="2-of-3" detail="simulated escrow" tone="good" />
            </div>
          </div>

          <section id="borrow" className="rounded-[2rem] border border-white/12 bg-[#f7faf9] p-3 text-[#091440] shadow-2xl shadow-black/30">
            <div className="rounded-[1.5rem] border border-[#dbe7e2] bg-white p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2970ff]">Instant quote</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Borrow against DCR</h2>
                </div>
                <div className="rounded-full bg-[#e7f8f3] px-3 py-1 text-sm font-semibold text-[#118864]">Demo</div>
              </div>

              <div className="mt-6 space-y-4">
                <AssetAmountCard
                  label="You borrow"
                  value={borrowAmount}
                  onChange={setBorrowAmount}
                  asset={borrowAsset}
                  onAssetChange={setBorrowAsset}
                  help="USDC is the recommended demo asset."
                />
                <AssetAmountCard
                  label="You lock"
                  value={collateralDcr}
                  onChange={setCollateralDcr}
                  asset="DCR"
                  help={payload ? `Using ${currency(payload.market.dcrUsd)} blended DCR/USD.` : "Loading blended DCR/USD."}
                />
              </div>

              <div className="mt-6 rounded-2xl border border-[#dbe7e2] bg-[#f7faf9] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[#5f716a]">Loan-to-value</p>
                    <p className="text-3xl font-semibold tracking-[-0.04em]">{formatBps(preview.ltvBps)}</p>
                  </div>
                  <RiskBadge ltvBps={preview.ltvBps} />
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#d9e4df]">
                  <div className={ltvBarClass(preview.ltvBps)} style={{ width: `${Math.min(ltvPct, 100)}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-xs font-medium text-[#6b7b74]">
                  <span>0%</span>
                  <span>35% target</span>
                  <span>70% liquidation</span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <MiniPanel label="Collateral value" value={currency(preview.collateralUsd)} />
                <MiniPanel label="Platform fee" value={currency(preview.originationFee)} />
                <MiniPanel label="Max at 35%" value={currency(preview.maxBorrowAt35Ltv)} />
              </div>

              <div className="mt-5 grid gap-2">
                {preview.warnings.length ? (
                  preview.warnings.slice(0, 3).map((warning) => <InlineWarning key={warning}>{warning}</InlineWarning>)
                ) : (
                  <div className="flex items-center gap-2 rounded-xl bg-[#e7f8f3] px-3 py-2 text-sm font-medium text-[#118864]">
                    <CheckCircle2 className="h-4 w-4" />
                    Quote is inside current demo guardrails.
                  </div>
                )}
              </div>

              {notice ? <InlineWarning>{notice}</InlineWarning> : null}

              <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr]">
                <button
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#cddbd5] bg-white px-4 text-sm font-semibold text-[#091440] hover:bg-[#f7faf9] disabled:opacity-60"
                  disabled={busy === "quote"}
                  onClick={createQuote}
                >
                  <Gauge className="h-4 w-4" />
                  {busy === "quote" ? "Pricing..." : "Price quote"}
                </button>
                <button
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#2970ff] px-4 text-sm font-semibold text-white shadow-lg shadow-[#2970ff]/25 hover:bg-[#1d5fe8] disabled:opacity-60"
                  disabled={busy === "loan"}
                  onClick={createLoan}
                >
                  {busy === "loan" ? "Creating..." : "Create demo loan"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid gap-3 p-3 sm:grid-cols-3">
              <TrustItem icon={LockKeyhole} label="Escrow" text="2-of-3 preview" />
              <TrustItem icon={BarChart3} label="Oracle" text="blended sources" />
              <TrustItem icon={Activity} label="Review" text="operator gated" />
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
    <label className="block rounded-2xl border border-[#dbe7e2] bg-white p-4 shadow-sm">
      <span className="text-sm font-medium text-[#5f716a]">{label}</span>
      <div className="mt-2 flex items-center gap-3">
        <input
          className="min-w-0 flex-1 bg-transparent text-4xl font-semibold tracking-[-0.05em] outline-none"
          min="0"
          type="number"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {onAssetChange ? (
          <select
            className="h-11 rounded-full border border-[#cddbd5] bg-[#f7faf9] px-3 text-sm font-semibold"
            value={asset}
            onChange={(event) => onAssetChange(event.target.value as Loan["borrowAsset"])}
          >
            <option>USDC</option>
            <option>USDT</option>
            <option>BTC</option>
          </select>
        ) : (
          <span className="rounded-full border border-[#cddbd5] bg-[#f7faf9] px-4 py-2 text-sm font-semibold">{asset}</span>
        )}
      </div>
      <span className="mt-2 block text-xs text-[#6b7b74]">{help}</span>
    </label>
  );
}

function HeroStat({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "good" | "warning" | "neutral" }) {
  const toneClass = tone === "good" ? "text-[#9bf0d6]" : tone === "warning" ? "text-[#ffd88a]" : "text-white";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-1 text-sm text-white/52">{detail}</p>
    </div>
  );
}

function MiniPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#dbe7e2] bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7b74]">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold">{value}</p>
    </div>
  );
}

function InlineWarning({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex gap-2 rounded-xl bg-[#fff4d8] px-3 py-2 text-sm text-[#6f4d00]">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function RiskBadge({ ltvBps }: { ltvBps: number }) {
  const label = ltvBps >= 7000 ? "Liquidation" : ltvBps >= 6000 ? "Warning" : ltvBps >= 4500 ? "Watch" : "Healthy";
  const className = ltvBps >= 6000 ? "bg-[#ffe8e5] text-[#a23b2a]" : ltvBps >= 4500 ? "bg-[#fff4d8] text-[#855d00]" : "bg-[#e7f8f3] text-[#118864]";
  return <span className={`rounded-full px-3 py-1 text-sm font-semibold ${className}`}>{label}</span>;
}

function TrustItem({ icon: Icon, label, text }: { icon: React.ComponentType<{ className?: string }>; label: string; text: string }) {
  return (
    <div className="rounded-2xl bg-white/70 p-3 text-[#091440]">
      <Icon className="h-4 w-4 text-[#2970ff]" />
      <p className="mt-2 text-sm font-semibold">{label}</p>
      <p className="text-xs text-[#5f716a]">{text}</p>
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
  if (ltvBps > 3500) warnings.push("This quote is above the 35% demo LTV target.");
  if (borrowAsset !== "USDC") warnings.push("USDC is the recommended demo borrow asset; other assets are roadmap items.");

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

function currency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}
