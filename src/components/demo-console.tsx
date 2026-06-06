"use client";

import {
  Activity,
  AlertTriangle,
  BadgeDollarSign,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Database,
  ExternalLink,
  FileText,
  Gauge,
  KeyRound,
  Landmark,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  TicketCheck,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import type { EscrowPreview, Loan, LoanAction, LoanEvent, MarketSnapshot, Quote, TicketCollateralNote } from "@/lib/types";
import { formatBps } from "@/lib/risk";

type Tab = "quote" | "status" | "repay" | "admin" | "market" | "docs";

interface DemoLoan extends Loan {
  riskLevel: "healthy" | "watch" | "warning" | "liquidation";
  escrowChecklist: string[];
}

interface DemoPayload {
  market: MarketSnapshot;
  loans: DemoLoan[];
  events: LoanEvent[];
  escrowPreview: EscrowPreview;
  ticketCollateralNote: TicketCollateralNote;
  trustModel: string[];
}

const tabs: Array<{ id: Tab; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: "quote", label: "Quote", icon: BadgeDollarSign },
  { id: "status", label: "Status", icon: Activity },
  { id: "repay", label: "Repay", icon: WalletCards },
  { id: "admin", label: "Operator", icon: ShieldCheck },
  { id: "market", label: "Market", icon: BarChart3 },
  { id: "docs", label: "Docs", icon: FileText },
];

export function DemoConsole() {
  const [payload, setPayload] = useState<DemoPayload | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("quote");
  const [selectedLoanId, setSelectedLoanId] = useState<string>("loan_demo_active");
  const [operatorMode, setOperatorMode] = useState(true);
  const [collateralDcr, setCollateralDcr] = useState(100);
  const [borrowAmount, setBorrowAmount] = useState(350);
  const [borrowAsset, setBorrowAsset] = useState<Loan["borrowAsset"]>("USDC");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh(preferredLoanId = selectedLoanId) {
    const response = await fetch("/api/demo", { cache: "no-store" });
    const nextPayload = (await response.json()) as DemoPayload;
    setPayload(nextPayload);
    const nextSelectedLoanId = nextPayload.loans.some((loan) => loan.id === preferredLoanId)
      ? preferredLoanId
      : nextPayload.loans[0]?.id ?? "";
    setSelectedLoanId(nextSelectedLoanId);
  }

  useEffect(() => {
    // This effect starts one async demo data load after the console mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh().catch(() => setNotice("Demo data could not load. Try refreshing the page."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedLoan = useMemo(
    () => payload?.loans.find((loan) => loan.id === selectedLoanId) ?? payload?.loans[0] ?? null,
    [payload, selectedLoanId],
  );

  const activeLoanEvents = useMemo(
    () => payload?.events.filter((event) => event.loanId === selectedLoan?.id).slice(0, 6) ?? [],
    [payload, selectedLoan],
  );

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
      setSelectedLoanId(result.loan.id);
      setNotice(`Created ${result.loan.ref}.`);
      await refresh(result.loan.id);
      setActiveTab("status");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Loan creation failed.");
    } finally {
      setBusy(null);
    }
  }

  async function runAction(action: LoanAction) {
    if (!selectedLoan) return;
    setBusy(action);
    setNotice(null);
    try {
      const response = await fetch("/api/loan-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loanId: selectedLoan.id, action }),
      });
      const result = (await response.json()) as { loan: Loan; event: LoanEvent; error?: string };
      if (!response.ok) throw new Error(result.error);
      setNotice(`${result.loan.ref} moved to ${readableStatus(result.loan.status)}.`);
      setPayload((current) => {
        if (!current) return current;

        return {
          ...current,
          loans: current.loans.map((loan) => (loan.id === result.loan.id ? { ...loan, ...result.loan } : loan)),
          events: [result.event, ...current.events.filter((event) => event.id !== result.event.id)].slice(0, 25),
        };
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7f6] text-[#17211d]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-[#d8dfda] pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-[#155e59] text-white">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#577067]">Demo mode</p>
              <h1 className="text-2xl font-semibold tracking-normal text-[#17211d] sm:text-3xl">
                Decred Capital Access
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium ${
                operatorMode
                  ? "border-[#155e59] bg-[#e3f4ef] text-[#155e59]"
                  : "border-[#ccd6d0] bg-white text-[#42524c]"
              }`}
              onClick={() => setOperatorMode((value) => !value)}
            >
              <KeyRound className="h-4 w-4" />
              Operator mode
            </button>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#ccd6d0] bg-white px-3 text-sm font-medium text-[#42524c] hover:bg-[#eef3f0]"
              onClick={() => refresh()}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </header>

        <section className="grid gap-4 py-5 lg:grid-cols-[1.1fr_0.9fr_0.9fr]">
          <Metric
            icon={CircleDollarSign}
            label="DCR/USD"
            value={payload ? currency(payload.market.dcrUsd) : "..."}
            detail={payload ? `${payload.market.sourceCount} live sources blended` : "Loading market data"}
          />
          <Metric
            icon={LockKeyhole}
            label="Collateral model"
            value="2-of-3 escrow"
            detail="Borrower, lender, independent arbiter"
          />
          <Metric
            icon={Database}
            label="Storage"
            value="Local SQLite"
            detail="Seeded demo data, no mainnet keys"
          />
        </section>

        <nav className="flex gap-2 overflow-x-auto border-b border-[#d8dfda] pb-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium ${
                  activeTab === tab.id ? "bg-[#17211d] text-white" : "bg-white text-[#42524c] hover:bg-[#eef3f0]"
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {notice ? (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-[#d8dfda] bg-white px-4 py-3 text-sm text-[#42524c]">
            <CheckCircle2 className="h-4 w-4 text-[#155e59]" />
            {notice}
          </div>
        ) : null}

        <div className="grid flex-1 gap-5 py-5 lg:grid-cols-[290px_1fr]">
          <aside className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#577067]">Loans</h2>
            <div className="space-y-2">
              {payload?.loans.map((loan) => (
                <button
                  key={loan.id}
                  className={`w-full rounded-md border p-3 text-left ${
                    selectedLoan?.id === loan.id
                      ? "border-[#155e59] bg-[#e3f4ef]"
                      : "border-[#d8dfda] bg-white hover:border-[#aebcb4]"
                  }`}
                  onClick={() => setSelectedLoanId(loan.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#17211d]">{loan.ref}</span>
                    <StatusPill status={loan.status} />
                  </div>
                  <p className="mt-2 text-sm text-[#577067]">
                    {loan.collateralDcr || "Ticket proof"} DCR collateral · {currency(loan.borrowAmount)}{" "}
                    {loan.borrowAsset}
                  </p>
                </button>
              ))}
            </div>
          </aside>

          <section className="min-w-0">
            {activeTab === "quote" ? (
              <QuoteScreen
                collateralDcr={collateralDcr}
                borrowAmount={borrowAmount}
                borrowAsset={borrowAsset}
                quote={quote}
                busy={busy}
                setCollateralDcr={setCollateralDcr}
                setBorrowAmount={setBorrowAmount}
                setBorrowAsset={setBorrowAsset}
                createQuote={createQuote}
                createLoan={createLoan}
              />
            ) : null}
            {activeTab === "status" && selectedLoan ? (
              <StatusScreen loan={selectedLoan} events={activeLoanEvents} />
            ) : null}
            {activeTab === "repay" && selectedLoan ? (
              <RepayScreen loan={selectedLoan} busy={busy} runAction={runAction} />
            ) : null}
            {activeTab === "admin" && selectedLoan ? (
              <AdminScreen
                loan={selectedLoan}
                operatorMode={operatorMode}
                busy={busy}
                runAction={runAction}
              />
            ) : null}
            {activeTab === "market" && payload ? <MarketScreen payload={payload} /> : null}
            {activeTab === "docs" && payload ? <DocsScreen payload={payload} /> : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function QuoteScreen(props: {
  collateralDcr: number;
  borrowAmount: number;
  borrowAsset: Loan["borrowAsset"];
  quote: Quote | null;
  busy: string | null;
  setCollateralDcr: (value: number) => void;
  setBorrowAmount: (value: number) => void;
  setBorrowAsset: (value: Loan["borrowAsset"]) => void;
  createQuote: () => void;
  createLoan: () => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-lg border border-[#d8dfda] bg-white p-5">
        <h2 className="text-xl font-semibold">Create quote</h2>
        <div className="mt-5 space-y-4">
          <NumberField label="DCR collateral" value={props.collateralDcr} onChange={props.setCollateralDcr} />
          <NumberField label="Borrow amount" value={props.borrowAmount} onChange={props.setBorrowAmount} />
          <label className="block">
            <span className="text-sm font-medium text-[#42524c]">Borrow asset</span>
            <select
              className="mt-2 h-11 w-full rounded-md border border-[#ccd6d0] bg-white px-3 text-sm"
              value={props.borrowAsset}
              onChange={(event) => props.setBorrowAsset(event.target.value as Loan["borrowAsset"])}
            >
              <option>USDC</option>
              <option>USDT</option>
              <option>BTC</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              className="inline-flex h-11 items-center gap-2 rounded-md bg-[#155e59] px-4 text-sm font-semibold text-white hover:bg-[#104d49]"
              onClick={props.createQuote}
              disabled={props.busy === "quote"}
            >
              <Gauge className="h-4 w-4" />
              Price quote
            </button>
            <button
              className="inline-flex h-11 items-center gap-2 rounded-md bg-[#17211d] px-4 text-sm font-semibold text-white hover:bg-[#2b3732]"
              onClick={props.createLoan}
              disabled={props.busy === "loan"}
            >
              <LockKeyhole className="h-4 w-4" />
              Create demo loan
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[#d8dfda] bg-white p-5">
        <h2 className="text-xl font-semibold">Quote result</h2>
        {props.quote ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStat label="Collateral value" value={currency(props.quote.collateralUsd)} />
              <MiniStat label="LTV" value={formatBps(props.quote.ltvBps)} />
              <MiniStat label="Origination fee" value={currency(props.quote.originationFee)} />
            </div>
            <div className="rounded-md bg-[#eef3f0] p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-[#42524c]">Max borrow at 35% LTV</span>
                <strong>{currency(props.quote.maxBorrowAt35Ltv)}</strong>
              </div>
              <div className="mt-3 h-2 rounded-full bg-[#d8dfda]">
                <div
                  className="h-2 rounded-full bg-[#155e59]"
                  style={{ width: `${Math.min(props.quote.ltvBps / 70, 100)}%` }}
                />
              </div>
            </div>
            {props.quote.warnings.length ? (
              <div className="space-y-2">
                {props.quote.warnings.map((warning) => (
                  <Warning key={warning}>{warning}</Warning>
                ))}
              </div>
            ) : (
              <p className="rounded-md bg-[#e3f4ef] p-3 text-sm text-[#155e59]">Quote is inside demo guardrails.</p>
            )}
          </div>
        ) : (
          <EmptyState icon={ClipboardList} title="No quote yet" text="Enter DCR collateral and a borrow amount." />
        )}
      </section>
    </div>
  );
}

function StatusScreen({ loan, events }: { loan: DemoLoan; events: LoanEvent[] }) {
  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[#d8dfda] bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold">{loan.ref}</h2>
              <StatusPill status={loan.status} />
              <RiskPill risk={loan.riskLevel} />
            </div>
            <p className="mt-2 text-[#577067]">{loan.borrowerName} borrowing against native DCR collateral.</p>
          </div>
          <div className="rounded-md bg-[#eef3f0] px-4 py-3 text-right">
            <p className="text-sm text-[#577067]">Current LTV</p>
            <p className="text-2xl font-semibold">{formatBps(loan.currentLtvBps)}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <MiniStat label="Collateral" value={`${loan.collateralDcr} DCR`} />
          <MiniStat label="Borrowed" value={`${currency(loan.borrowAmount)} ${loan.borrowAsset}`} />
          <MiniStat label="APR" value={formatBps(loan.aprBps)} />
          <MiniStat label="Due" value={shortDate(loan.dueAt)} />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-[#d8dfda] bg-white p-5">
          <h3 className="font-semibold">Escrow controls</h3>
          <div className="mt-4 space-y-2">
            {loan.escrowChecklist.map((item) => (
              <div key={item} className="flex gap-3 rounded-md bg-[#f7f9f8] p-3 text-sm text-[#42524c]">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#155e59]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-[#d8dfda] bg-white p-5">
          <h3 className="font-semibold">Activity</h3>
          <div className="mt-4 space-y-3">
            {events.map((event) => (
              <div key={event.id} className="border-l-2 border-[#155e59] pl-3">
                <p className="text-sm font-medium">{event.message}</p>
                <p className="text-xs text-[#6b7b74]">{shortDateTime(event.createdAt)} · {event.actor}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function RepayScreen({
  loan,
  busy,
  runAction,
}: {
  loan: DemoLoan;
  busy: string | null;
  runAction: (action: LoanAction) => void;
}) {
  const payoff = Number((loan.borrowAmount * (1 + loan.aprBps / 10000 / 12)).toFixed(2));
  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-lg border border-[#d8dfda] bg-white p-5">
        <h2 className="text-xl font-semibold">Repayment</h2>
        <div className="mt-5 space-y-3">
          <MiniStat label="Estimated payoff" value={`${currency(payoff)} ${loan.borrowAsset}`} />
          <MiniStat label="Repayment target" value="Base Sepolia demo address" />
          <MiniStat label="Collateral return" value={loan.escrowAddress} />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <ActionButton icon={WalletCards} label="Detect repayment" busy={busy} action="simulate_repayment" onClick={runAction} />
          <ActionButton icon={LockKeyhole} label="Release collateral" busy={busy} action="release_collateral" onClick={runAction} />
        </div>
      </section>
      <section className="rounded-lg border border-[#d8dfda] bg-white p-5">
        <h2 className="text-xl font-semibold">Release logic</h2>
        <div className="mt-5 space-y-3">
          <FlowStep label="1" text="Repayment transfer is detected at the borrow-asset target." />
          <FlowStep label="2" text="Operator verifies amount, timestamp, and loan reference." />
          <FlowStep label="3" text="Borrower and lender, or lender and arbiter, sign a Decred release transaction." />
          <FlowStep label="4" text="Collateral returns to the borrower refund address." />
        </div>
      </section>
    </div>
  );
}

function AdminScreen({
  loan,
  operatorMode,
  busy,
  runAction,
}: {
  loan: DemoLoan;
  operatorMode: boolean;
  busy: string | null;
  runAction: (action: LoanAction) => void;
}) {
  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[#d8dfda] bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Operator desk</h2>
            <p className="mt-2 text-sm text-[#577067]">Manual review stays in the loop for v1 risk controls.</p>
          </div>
          <StatusPill status={loan.status} />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <ActionButton icon={CheckCircle2} label="Detect collateral" action="simulate_collateral" busy={busy} onClick={runAction} disabled={!operatorMode} />
          <ActionButton icon={CircleDollarSign} label="Approve/fund" action="approve_and_fund" busy={busy} onClick={runAction} disabled={!operatorMode} />
          <ActionButton icon={AlertTriangle} label="Margin warning" action="mark_margin_warning" busy={busy} onClick={runAction} disabled={!operatorMode} />
          <ActionButton icon={Gauge} label="Liquidation review" action="start_liquidation_review" busy={busy} onClick={runAction} disabled={!operatorMode} />
          <ActionButton icon={AlertTriangle} label="Default" action="mark_defaulted" busy={busy} onClick={runAction} disabled={!operatorMode} />
          <ActionButton icon={ShieldCheck} label="Complete liquidation" action="complete_liquidation" busy={busy} onClick={runAction} disabled={!operatorMode} />
        </div>
      </section>
      <section className="rounded-lg border border-[#d8dfda] bg-white p-5">
        <h3 className="font-semibold">Mainnet alpha guardrails</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            "Small loan caps until real liquidation data exists.",
            "Blended oracle with stale and divergent source rejection.",
            "Separate borrower, lender, and arbiter signing keys.",
            "Circuit breaker when DCRDEX or Kraken depth is thin.",
          ].map((item) => (
            <div key={item} className="flex gap-3 rounded-md bg-[#f7f9f8] p-3 text-sm">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#155e59]" />
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MarketScreen({ payload }: { payload: DemoPayload }) {
  const market = payload.market;
  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-4">
        <MiniStat label="Blended DCR/USD" value={currency(market.dcrUsd)} />
        <MiniStat label="DCR/BTC" value={market.dcrBtc.toFixed(8)} />
        <MiniStat label="Kraken bid/ask" value={`${market.krakenBid ?? "n/a"} / ${market.krakenAsk ?? "n/a"}`} />
        <MiniStat label="DCRDEX DCR/BTC" value={`${market.dcrdexBestBid ?? "n/a"} / ${market.dcrdexBestAsk ?? "n/a"}`} />
      </section>
      <section className="rounded-lg border border-[#d8dfda] bg-white p-5">
        <h2 className="text-xl font-semibold">Liquidity readout</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            <FlowStep label="A" text="Kraken public APIs provide DCRUSD ticker, depth, trades, and OHLC for oracle input." />
            <FlowStep label="B" text="DCRDEX gives useful DCR/BTC order-book context and ecosystem-native routing." />
            <FlowStep label="C" text="DCR/stable DCRDEX books may be empty, so stable liquidation is not automatic in v1." />
          </div>
          <div className="rounded-md bg-[#f7f9f8] p-4">
            <p className="text-sm font-semibold text-[#42524c]">Warnings</p>
            <div className="mt-3 space-y-2">
              {market.warnings.length ? market.warnings.map((warning) => <Warning key={warning}>{warning}</Warning>) : <p className="text-sm text-[#577067]">No active warnings.</p>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function DocsScreen({ payload }: { payload: DemoPayload }) {
  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[#d8dfda] bg-white p-5">
        <h2 className="text-xl font-semibold">Trust model</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {payload.trustModel.map((item) => (
            <div key={item} className="flex gap-3 rounded-md bg-[#f7f9f8] p-3 text-sm">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#155e59]" />
              {item}
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-[#d8dfda] bg-white p-5">
        <div className="flex items-start gap-3">
          <TicketCheck className="mt-1 h-5 w-5 text-[#a65f00]" />
          <div>
            <h2 className="text-xl font-semibold">{payload.ticketCollateralNote.title}</h2>
            <p className="mt-2 text-[#42524c]">{payload.ticketCollateralNote.summary}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Warning>{payload.ticketCollateralNote.blocker}</Warning>
              <div className="rounded-md bg-[#e3f4ef] p-3 text-sm text-[#155e59]">
                {payload.ticketCollateralNote.nextValidation}
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="rounded-lg border border-[#d8dfda] bg-white p-5">
        <h2 className="text-xl font-semibold">Source-backed research</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {[
            ["Decred RPC commands", "https://docs.decred.org/wallets/cli/dcrctl-rpc-commands/"],
            ["Decred testnet", "https://devdocs.decred.org/environments/testnet/"],
            ["DCRDEX repository", "https://github.com/decred/dcrdex"],
            ["Kraken market data", "https://docs.kraken.com/api/docs/category/rest-api/market-data/"],
            ["Cake Wallet Decred module", "https://github.com/cake-tech/cake_wallet/tree/dev/cw_decred"],
            ["Liquidium SDK", "https://github.com/Liquidium-Inc/liquidium-sdk"],
          ].map(([label, href]) => (
            <a
              key={href}
              className="inline-flex items-center justify-between gap-3 rounded-md border border-[#d8dfda] bg-[#f7f9f8] px-3 py-2 text-sm font-medium text-[#17211d] hover:border-[#155e59]"
              href={href}
              target="_blank"
              rel="noreferrer"
            >
              {label}
              <ExternalLink className="h-4 w-4" />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-[#d8dfda] bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-[#eef3f0] text-[#155e59]">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-[#577067]">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-[#6b7b74]">{detail}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-[#d8dfda] bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#6b7b74]">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-[#17211d]">{value}</p>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-[#42524c]">{label}</span>
      <input
        className="mt-2 h-11 w-full rounded-md border border-[#ccd6d0] bg-white px-3 text-sm"
        type="number"
        min="0"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ActionButton({
  icon: Icon,
  label,
  action,
  busy,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  action: LoanAction;
  busy: string | null;
  onClick: (action: LoanAction) => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="inline-flex h-10 items-center gap-2 rounded-md border border-[#ccd6d0] bg-white px-3 text-sm font-medium text-[#17211d] hover:bg-[#eef3f0]"
      onClick={() => onClick(action)}
      disabled={disabled || busy === action}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function StatusPill({ status }: { status: Loan["status"] }) {
  return (
    <span className="inline-flex rounded-full bg-[#eef3f0] px-2.5 py-1 text-xs font-semibold text-[#42524c]">
      {readableStatus(status)}
    </span>
  );
}

function RiskPill({ risk }: { risk: DemoLoan["riskLevel"] }) {
  const color =
    risk === "healthy"
      ? "bg-[#e3f4ef] text-[#155e59]"
      : risk === "watch"
        ? "bg-[#fff4d8] text-[#855d00]"
        : "bg-[#ffe8e5] text-[#a23b2a]";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{risk}</span>;
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-md bg-[#fff4d8] p-3 text-sm text-[#6f4d00]">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function FlowStep({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-md bg-[#f7f9f8] p-3 text-sm text-[#42524c]">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#17211d] text-xs font-semibold text-white">
        {label}
      </span>
      <span className="pt-1">{text}</span>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="mt-5 grid min-h-56 place-items-center rounded-md border border-dashed border-[#c4d0c8] bg-[#f7f9f8] p-8 text-center">
      <div>
        <Icon className="mx-auto h-8 w-8 text-[#6b7b74]" />
        <p className="mt-3 font-semibold">{title}</p>
        <p className="mt-1 text-sm text-[#6b7b74]">{text}</p>
      </div>
    </div>
  );
}

function currency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function readableStatus(status: Loan["status"]): string {
  return status.replaceAll("_", " ");
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function shortDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
