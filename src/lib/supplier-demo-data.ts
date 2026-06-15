import type { BorrowAsset } from "./protocol/assets";
import type { SupplierFill } from "./protocol/supplier-offers";

export type DemoSupplierOfferStatus = "active" | "paused" | "canceled";

export interface DemoSupplierOffer {
  id: string;
  supplierId: string;
  borrowAsset: BorrowAsset;
  availableAmount: number;
  aprBps: number;
  minFillAmount: number;
  maxDurationDays: number;
  status: DemoSupplierOfferStatus;
}

export interface DemoSupplierOfferFill {
  fillId: string;
  supplierOfferId: string;
  supplierId: string;
  borrowAsset: BorrowAsset;
  amount: number;
  aprBps: number;
  fundingShareBps: number;
  status: "reserved";
}

export type DemoSupplierFundingStatus = "unfunded" | "partially_filled" | "funded";

export interface DemoSupplierOfferAllocation {
  fills: DemoSupplierOfferFill[];
  filledAmount: number;
  remainingAmount: number;
  activeCapacity: number;
  fundingProgressBps: number;
  status: DemoSupplierFundingStatus;
}

const demoSupplierOffers: DemoSupplierOffer[] = [
  {
    id: "supplier-offer-1",
    supplierId: "supplier-demo-1",
    borrowAsset: "USDC",
    availableAmount: 1_200,
    aprBps: 1450,
    minFillAmount: 100,
    maxDurationDays: 45,
    status: "active",
  },
  {
    id: "supplier-offer-2",
    supplierId: "supplier-demo-2",
    borrowAsset: "USDC",
    availableAmount: 800,
    aprBps: 1525,
    minFillAmount: 100,
    maxDurationDays: 30,
    status: "paused",
  },
  {
    id: "supplier-offer-3",
    supplierId: "supplier-demo-3",
    borrowAsset: "USDC",
    availableAmount: 600,
    aprBps: 1575,
    minFillAmount: 75,
    maxDurationDays: 60,
    status: "active",
  },
  {
    id: "supplier-offer-4",
    supplierId: "supplier-demo-btc",
    borrowAsset: "BTC",
    availableAmount: 0.04,
    aprBps: 1200,
    minFillAmount: 0.005,
    maxDurationDays: 30,
    status: "active",
  },
  {
    id: "supplier-offer-5",
    supplierId: "supplier-demo-usdt",
    borrowAsset: "USDT",
    availableAmount: 900,
    aprBps: 1500,
    minFillAmount: 100,
    maxDurationDays: 30,
    status: "canceled",
  },
];

export function getDemoSupplierOffers(): DemoSupplierOffer[] {
  return demoSupplierOffers.map((offer) => ({ ...offer }));
}

export function getActiveSupplierCapacity(input: {
  borrowAsset: BorrowAsset;
  durationDays: number;
  offers?: DemoSupplierOffer[];
}): number {
  return getEligibleDemoSupplierOffers(input).reduce((total, offer) => total + offer.availableAmount, 0);
}

export function allocateSupplierOffersToBorrowerRequest(input: {
  borrowAsset: BorrowAsset;
  requestedAmount: number;
  durationDays: number;
  offers: DemoSupplierOffer[];
}): DemoSupplierOfferAllocation {
  const requestedAmount = roundAssetAmount(Math.max(input.requestedAmount, 0));
  let remainingAmount = requestedAmount;
  const fills: DemoSupplierOfferFill[] = [];
  const eligibleOffers = getEligibleDemoSupplierOffers(input);
  const activeCapacity = roundAssetAmount(eligibleOffers.reduce((total, offer) => total + offer.availableAmount, 0));

  for (const offer of eligibleOffers) {
    if (remainingAmount <= 0) break;

    const fillAmount = roundAssetAmount(Math.min(offer.availableAmount, remainingAmount));
    if (fillAmount < offer.minFillAmount) continue;

    fills.push({
      fillId: `borrower-demo-fill-${fills.length + 1}`,
      supplierOfferId: offer.id,
      supplierId: offer.supplierId,
      borrowAsset: offer.borrowAsset,
      amount: fillAmount,
      aprBps: offer.aprBps,
      fundingShareBps: 0,
      status: "reserved",
    });
    remainingAmount = roundAssetAmount(remainingAmount - fillAmount);
  }

  const filledAmount = roundAssetAmount(fills.reduce((total, fill) => total + fill.amount, 0));
  const fundingProgressBps = requestedAmount > 0 ? (Math.min(filledAmount, requestedAmount) / requestedAmount) * 10_000 : 0;
  const fillsWithShares = fills.map((fill) => ({
    ...fill,
    fundingShareBps: filledAmount > 0 ? (fill.amount / filledAmount) * 10_000 : 0,
  }));

  return {
    fills: fillsWithShares,
    filledAmount,
    remainingAmount: roundAssetAmount(Math.max(requestedAmount - filledAmount, 0)),
    activeCapacity,
    fundingProgressBps,
    status: resolveSupplierFundingStatus(filledAmount, requestedAmount),
  };
}

export function createSupplierFillsFromDemoAllocation(input: {
  loanRequestId: string;
  allocation: DemoSupplierOfferAllocation;
  reservedAt: string;
}): SupplierFill[] {
  return input.allocation.fills.map((fill) => ({
    id: fill.fillId,
    loanRequestId: input.loanRequestId,
    supplierOfferId: fill.supplierOfferId,
    supplierId: fill.supplierId,
    borrowAsset: fill.borrowAsset,
    amount: fill.amount,
    aprBps: fill.aprBps,
    status: fill.status,
    reservedAt: input.reservedAt,
  }));
}

function getEligibleDemoSupplierOffers(input: {
  borrowAsset: BorrowAsset;
  durationDays: number;
  offers?: DemoSupplierOffer[];
}): DemoSupplierOffer[] {
  return (input.offers ?? getDemoSupplierOffers())
    .filter((offer) => offer.status === "active")
    .filter((offer) => offer.borrowAsset === input.borrowAsset)
    .filter((offer) => offer.maxDurationDays >= input.durationDays)
    .filter((offer) => offer.availableAmount > 0)
    .toSorted((left, right) => left.aprBps - right.aprBps || left.id.localeCompare(right.id));
}

function resolveSupplierFundingStatus(filledAmount: number, requestedAmount: number): DemoSupplierFundingStatus {
  if (filledAmount <= 0) return "unfunded";
  if (filledAmount >= requestedAmount) return "funded";
  return "partially_filled";
}

function roundAssetAmount(value: number): number {
  return Number(value.toFixed(8));
}
