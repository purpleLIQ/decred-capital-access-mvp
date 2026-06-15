"use client";

import { ArrowLeft, Pause, Pencil, Play, Plus, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { createBorrowerProtocolQuoteSummary } from "@/lib/borrower-protocol-quote";
import {
  createSupplierPositionPreviewsFromAcceptedQuote,
  type SupplierPositionPreview,
} from "@/lib/supplier-position-previews";
import {
  getActiveSupplierCapacity,
  getDemoSupplierOffers,
  type DemoSupplierOffer,
  type DemoSupplierOfferStatus,
} from "@/lib/supplier-demo-data";

const acceptedQuotePreview = {
  collateralDcr: 430,
  borrowAmount: 1_500,
  borrowAsset: "USDC" as const,
  durationDays: 30,
};

export function SupplierOffersDemo() {
  const [offers, setOffers] = useState<DemoSupplierOffer[]>(() => getDemoSupplierOffers());
  const [amount, setAmount] = useState(500);
  const [aprBps, setAprBps] = useState(1500);
  const [asset, setAsset] = useState<DemoSupplierOffer["borrowAsset"]>("USDC");

  const activeCapacity = useMemo(
    () => getActiveSupplierCapacity({ borrowAsset: asset, durationDays: 30, offers }),
    [asset, offers],
  );
  const positionPreview = useMemo(() => {
    const quote = createBorrowerProtocolQuoteSummary({ ...acceptedQuotePreview, offers });

    return createSupplierPositionPreviewsFromAcceptedQuote({
      quote,
      loanId: "loan-demo-accepted-quote",
      borrowerId: "borrower-demo",
      borrowerLoanRef: "DCL-ACCEPTED-001",
      durationDays: acceptedQuotePreview.durationDays,
      borrowerAcceptedPartialFunding: false,
    });
  }, [offers]);

  function addOffer() {
    const nextOffer: DemoSupplierOffer = {
      id: `supplier-offer-${offers.length + 1}`,
      supplierId: `supplier-demo-${offers.length + 1}`,
      borrowAsset: asset,
      availableAmount: Math.max(amount, 0),
      aprBps: Math.max(aprBps, 0),
      minFillAmount: asset === "BTC" ? 0.005 : 100,
      maxDurationDays: 30,
      status: "active",
    };

    setOffers((current) => [nextOffer, ...current]);
  }

  function editOffer(id: string) {
    setOffers((current) =>
      current.map((offer) =>
        offer.id === id
          ? {
              ...offer,
              availableAmount: Number((offer.availableAmount + (offer.borrowAsset === "BTC" ? 0.005 : 100)).toFixed(8)),
              aprBps: offer.aprBps + 25,
            }
          : offer,
      ),
    );
  }

  function pauseOffer(id: string) {
    setOffers((current) => current.map((offer) => (offer.id === id ? { ...offer, status: "paused" } : offer)));
  }

  function activateOffer(id: string) {
    setOffers((current) => current.map((offer) => (offer.id === id ? { ...offer, status: "active" } : offer)));
  }

  function cancelOffer(id: string) {
    setOffers((current) => current.map((offer) => (offer.id === id ? { ...offer, status: "canceled" } : offer)));
  }

  return (
    <main className="min-h-screen bg-[#f5f7f6] px-4 py-6 text-[#17211d] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-[#d8dfda] pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <Link className="inline-flex items-center gap-2 text-sm font-medium text-[#155e59]" href="/ops">
              <ArrowLeft className="h-4 w-4" />
              Back to ops
            </Link>
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#577067]">Supplier desk</p>
            <h1 className="mt-1 text-3xl font-semibold">Offer demo</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#577067]">
              Supplier liquidity now feeds borrower quote fills, then accepted fills become supplier position previews.
            </p>
          </div>
          <div className="rounded-lg border border-[#d8dfda] bg-white px-4 py-3 text-sm">
            <p className="font-semibold text-[#155e59]">Active capacity</p>
            <p className="mt-1 text-2xl font-semibold">{formatOfferAmount(activeCapacity, asset)}</p>
            <p className="mt-1 text-xs text-[#6b7b74]">Matching active {asset} capacity for a 30-day request.</p>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-lg border border-[#d8dfda] bg-white p-5">
            <h2 className="text-xl font-semibold">Create offer</h2>
            <p className="mt-1 text-sm text-[#577067]">Prototype inputs for supplier-side offer creation.</p>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-[#42524c]">
                Asset
                <select
                  className="mt-1 h-11 w-full rounded-md border border-[#cddbd5] bg-white px-3"
                  value={asset}
                  onChange={(event) => setAsset(event.target.value as DemoSupplierOffer["borrowAsset"])}
                >
                  <option>USDC</option>
                  <option>USDT</option>
                  <option>BTC</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-[#42524c]">
                Available amount
                <input
                  className="mt-1 h-11 w-full rounded-md border border-[#cddbd5] px-3"
                  min="0"
                  type="number"
                  value={amount}
                  onChange={(event) => setAmount(Number(event.target.value))}
                />
              </label>
              <label className="block text-sm font-medium text-[#42524c]">
                APR bps
                <input
                  className="mt-1 h-11 w-full rounded-md border border-[#cddbd5] px-3"
                  min="0"
                  type="number"
                  value={aprBps}
                  onChange={(event) => setAprBps(Number(event.target.value))}
                />
              </label>
              <button
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#155e59] px-4 text-sm font-semibold text-white hover:bg-[#104d49]"
                onClick={addOffer}
              >
                <Plus className="h-4 w-4" />
                Create demo offer
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-[#d8dfda] bg-white p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Supplier offers</h2>
                <p className="mt-1 text-sm text-[#577067]">Local demo lifecycle controls backed by shared seeded offers.</p>
              </div>
              <span className="rounded-full bg-[#e3f4ef] px-3 py-1 text-sm font-semibold text-[#155e59]">{offers.length} offers</span>
            </div>
            <div className="mt-5 space-y-3">
              {offers.map((offer) => (
                <article key={offer.id} className="rounded-lg border border-[#d8dfda] bg-[#fbfcfb] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{offer.supplierId}</h3>
                        <StatusBadge status={offer.status} />
                      </div>
                      <p className="mt-1 text-sm text-[#577067]">{offer.id}</p>
                    </div>
                    <div className="grid gap-2 text-sm sm:grid-cols-4 md:min-w-[24rem]">
                      <Stat label="Asset" value={offer.borrowAsset} />
                      <Stat label="Available" value={formatOfferAmount(offer.availableAmount, offer.borrowAsset)} />
                      <Stat label="APR" value={`${(offer.aprBps / 100).toFixed(2)}%`} />
                      <Stat label="Max term" value={`${offer.maxDurationDays} days`} />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className="inline-flex h-9 items-center gap-2 rounded-md border border-[#cddbd5] bg-white px-3 text-xs font-semibold" onClick={() => editOffer(offer.id)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit +100 / +25bps
                    </button>
                    {offer.status === "active" ? (
                      <button className="inline-flex h-9 items-center gap-2 rounded-md border border-[#cddbd5] bg-white px-3 text-xs font-semibold" onClick={() => pauseOffer(offer.id)}>
                        <Pause className="h-3.5 w-3.5" />
                        Pause
                      </button>
                    ) : (
                      <button className="inline-flex h-9 items-center gap-2 rounded-md border border-[#cddbd5] bg-white px-3 text-xs font-semibold" onClick={() => activateOffer(offer.id)} disabled={offer.status === "canceled"}>
                        <Play className="h-3.5 w-3.5" />
                        Activate
                      </button>
                    )}
                    <button className="inline-flex h-9 items-center gap-2 rounded-md border border-[#ed6d47]/30 bg-white px-3 text-xs font-semibold text-[#8b2f22]" onClick={() => cancelOffer(offer.id)}>
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <SupplierPositionPreviewPanel preview={positionPreview} />
      </div>
    </main>
  );
}

function SupplierPositionPreviewPanel({ preview }: { preview: ReturnType<typeof createSupplierPositionPreviewsFromAcceptedQuote> }) {
  return (
    <section className="rounded-lg border border-[#d8dfda] bg-white p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#155e59]">Accepted quote lifecycle</p>
          <h2 className="mt-1 text-xl font-semibold">Supplier position previews</h2>
          <p className="mt-1 max-w-3xl text-sm text-[#577067]">
            Positions are generated from borrower quote fills after a funded quote is accepted. Partial fills stay out of position accounting until borrower acceptance is explicit.
          </p>
        </div>
        <div className="rounded-lg bg-[#f7f9f8] px-4 py-3 text-sm">
          <p className="font-semibold text-[#42524c]">{preview.borrowerLoanRef}</p>
          <p className="mt-1 text-[#577067]">{preview.fundingStatus}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <Stat label="Positions" value={`${preview.acceptedFillCount}`} />
        <Stat label="Principal" value={formatOfferAmount(preview.totalPrincipal, "USDC")} />
        <Stat label="Interest due" value={formatOfferAmount(preview.totalInterestDue, "USDC")} />
        <Stat label="Remaining due" value={formatOfferAmount(preview.remainingDue, "USDC")} />
      </div>

      <div className="mt-5 space-y-3">
        {preview.positions.length ? (
          preview.positions.map((position) => <SupplierPositionCard key={position.id} position={position} />)
        ) : (
          <div className="rounded-lg bg-[#fff4d8] p-4 text-sm text-[#6f4d00]">{preview.notes[0]}</div>
        )}
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {preview.notes.map((note) => (
          <div key={note} className="rounded-md bg-[#f7f9f8] px-3 py-2 text-xs text-[#42524c]">
            {note}
          </div>
        ))}
      </div>
    </section>
  );
}

function SupplierPositionCard({ position }: { position: SupplierPositionPreview }) {
  return (
    <article className="rounded-lg border border-[#d8dfda] bg-[#fbfcfb] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{position.supplierId}</h3>
            <span className="rounded-full bg-[#e3f4ef] px-2 py-0.5 text-xs font-semibold text-[#155e59]">{position.status}</span>
          </div>
          <p className="mt-1 text-sm text-[#577067]">{position.id}</p>
          <p className="mt-1 text-xs text-[#6b7b74]">Fill {position.fillId} from offer {position.supplierOfferId}</p>
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-4 md:min-w-[30rem]">
          <Stat label="Principal" value={formatOfferAmount(position.principal, position.borrowAsset)} />
          <Stat label="APR" value={`${(position.aprBps / 100).toFixed(2)}%`} />
          <Stat label="Interest" value={formatOfferAmount(position.interestDue, position.borrowAsset)} />
          <Stat label="Total due" value={formatOfferAmount(position.totalDue, position.borrowAsset)} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-[#42524c] md:grid-cols-3">
        <span>Loan: {position.borrowerLoanRef}</span>
        <span>Repayment address: {position.repaymentAddress}</span>
        <span>Remaining due: {formatOfferAmount(position.remainingDue, position.borrowAsset)}</span>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white px-3 py-2">
      <p className="text-xs uppercase tracking-[0.12em] text-[#6b7b74]">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: DemoSupplierOfferStatus }) {
  const className =
    status === "active"
      ? "bg-[#e3f4ef] text-[#155e59]"
      : status === "paused"
        ? "bg-[#fff4d8] text-[#855d00]"
        : "bg-[#ffe8e5] text-[#8b2f22]";

  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>{status}</span>;
}

function formatOfferAmount(amount: number, asset: DemoSupplierOffer["borrowAsset"]): string {
  const maximumFractionDigits = asset === "BTC" ? 8 : 2;
  return `${amount.toLocaleString("en-US", { maximumFractionDigits })} ${asset}`;
}
