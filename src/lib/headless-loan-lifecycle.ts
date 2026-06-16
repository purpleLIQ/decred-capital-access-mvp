import { createBorrowerProtocolQuoteSummary, type BorrowerProtocolQuoteSummary } from "./borrower-protocol-quote";
import type { EvidenceTimestampAnchor } from "./evidence-timestamps";
import { emptyEvidenceTimestampAnchor } from "./evidence-timestamps";
import type { Loan } from "./types";
import { allocateRepaymentAcrossSupplierPositions, type SupplierRepaymentAllocationPreview } from "./supplier-repayment-allocation";
import {
  createAcceptedSupplierFillsFromQuote,
  createSupplierPositionPreviewsFromAcceptedQuote,
  type SupplierPositionPreview,
} from "./supplier-position-previews";
import type { DemoSupplierOffer } from "./supplier-demo-data";
import { getDemoSupplierOffers } from "./supplier-demo-data";
import type { SupplierFill } from "./protocol/supplier-offers";

export const treasuryRequestThresholdUsd = 10_000;

export type BorrowerContactPreference = "none" | "email" | "other";
export type FundingRouteKind = "supplier_pool" | "treasury_review" | "mixed_supplier_treasury" | "waiting_for_liquidity";
export type HeadlessLoanLifecycleStatus =
  | "quote_created"
  | "quote_accepted"
  | "awaiting_liquidity"
  | "awaiting_collateral_lock"
  | "awaiting_supplier_disbursement"
  | "repayment_pending"
  | "ready_for_lookup";

export interface OptionalBorrowerContact {
  preference: BorrowerContactPreference;
  value?: string;
  consentForUpdates: boolean;
  note: string;
}

export interface LifecycleStatusSection<TStatus extends string> {
  status: TStatus;
  detail: string;
  updatedAt: string;
}

export interface FundingRouteStatus extends LifecycleStatusSection<FundingRouteKind> {
  treasuryRequestThresholdUsd: number;
  requestedAmountUsd: number;
  supplierFilledAmount: number;
  treasuryReviewRequired: boolean;
}

export interface EvidenceBundleStatus extends LifecycleStatusSection<"placeholder" | "prepared" | "committed"> {
  commitmentScheme: "sha256_placeholder" | "future_decred_blake256_or_merkle";
  bundleId: string;
  timestamp: EvidenceTimestampAnchor;
}

export interface HeadlessLoanLifecycleRecord {
  loanId: string;
  publicLoanReference: string;
  lookupCode: string;
  borrowerContact: OptionalBorrowerContact;
  borrowAsset: Loan["borrowAsset"];
  requestedAmount: number;
  requestedAmountUsd: number;
  durationDays: number;
  quoteStatus: "quoted" | "accepted";
  fundingStatus: BorrowerProtocolQuoteSummary["fundingStatus"];
  acceptedSupplierFills: SupplierFill[];
  supplierPositions: SupplierPositionPreview[];
  repaymentAllocationPreview: SupplierRepaymentAllocationPreview;
  lifecycleStatus: HeadlessLoanLifecycleStatus;
  nextBorrowerAction: string;
  nextSupplierOperatorAction: string;
  timestamps: {
    createdAt: string;
    quoteCreatedAt: string;
    quoteAcceptedAt?: string;
    lastUpdatedAt: string;
  };
  quote: BorrowerProtocolQuoteSummary;
  collateralLock: LifecycleStatusSection<"not_started" | "awaiting_borrower" | "locked" | "failed">;
  dcrPlatformFeeOutput: LifecycleStatusSection<"not_started" | "previewed" | "detected" | "routed">;
  supplierDisbursement: LifecycleStatusSection<"not_started" | "awaiting_funding" | "ready" | "disbursed">;
  repaymentDetection: LifecycleStatusSection<"not_started" | "watcher_placeholder" | "partial" | "detected">;
  collateralRelease: LifecycleStatusSection<"not_started" | "blocked" | "ready" | "released">;
  liquidationHealth: LifecycleStatusSection<"healthy" | "watch" | "warning" | "liquidation_review">;
  arbiterReview: LifecycleStatusSection<"not_required" | "available" | "requested" | "resolved">;
  evidenceBundle: EvidenceBundleStatus;
  fundingRoute: FundingRouteStatus;
}

export interface HeadlessLoanLifecycleInput {
  loanId?: string;
  publicLoanReference?: string;
  borrowerContact?: Partial<OptionalBorrowerContact>;
  collateralDcr: number;
  borrowAmount: number;
  borrowAsset: Loan["borrowAsset"];
  durationDays?: number;
  borrowerAcceptedQuote?: boolean;
  borrowerAcceptedPartialFunding?: boolean;
  repaymentAmount?: number;
  requestedAmountUsd?: number;
  now?: string;
  offers?: DemoSupplierOffer[];
}

const DEFAULT_NOW = "2026-06-15T20:00:00.000Z";
const DEFAULT_DURATION_DAYS = 30;

export function createHeadlessLoanLifecycleRecord(input: HeadlessLoanLifecycleInput): HeadlessLoanLifecycleRecord {
  const now = input.now ?? DEFAULT_NOW;
  const durationDays = input.durationDays ?? DEFAULT_DURATION_DAYS;
  const requestedAmountUsd = input.requestedAmountUsd ?? estimateRequestedAmountUsd(input.borrowAmount, input.borrowAsset);
  const publicLoanReference = input.publicLoanReference ?? createPublicLoanReference(input.borrowAsset, input.borrowAmount, now);
  const loanId = input.loanId ?? `loan-${publicLoanReference.toLowerCase()}`;
  const borrowerAcceptedQuote = input.borrowerAcceptedQuote ?? false;
  const borrowerAcceptedPartialFunding = input.borrowerAcceptedPartialFunding ?? false;
  const quote = createBorrowerProtocolQuoteSummary({
    collateralDcr: input.collateralDcr,
    borrowAmount: input.borrowAmount,
    borrowAsset: input.borrowAsset,
    durationDays,
    offers: input.offers ?? getDemoSupplierOffers(),
  });
  const positionsPreview = createSupplierPositionPreviewsFromAcceptedQuote({
    quote,
    loanId,
    borrowerId: "headless-borrower",
    borrowerLoanRef: publicLoanReference,
    durationDays,
    borrowerAcceptedPartialFunding,
  });
  const acceptedSupplierFills = borrowerAcceptedQuote
    ? createAcceptedSupplierFillsFromQuote(quote, loanId, now)
    : [];
  const supplierPositions = borrowerAcceptedQuote ? positionsPreview.positions : [];
  const repaymentAllocationPreview = allocateRepaymentAcrossSupplierPositions({
    positions: supplierPositions,
    repaymentAmount: input.repaymentAmount ?? 0,
  });
  const fundingRoute = resolveFundingRoute({ quote, requestedAmountUsd });
  const lifecycleStatus = resolveLifecycleStatus({ borrowerAcceptedQuote, quote, supplierPositions });

  return {
    loanId,
    publicLoanReference,
    lookupCode: publicLoanReference,
    borrowerContact: normalizeBorrowerContact(input.borrowerContact),
    borrowAsset: input.borrowAsset,
    requestedAmount: input.borrowAmount,
    requestedAmountUsd,
    durationDays,
    quoteStatus: borrowerAcceptedQuote ? "accepted" : "quoted",
    fundingStatus: quote.fundingStatus,
    acceptedSupplierFills,
    supplierPositions,
    repaymentAllocationPreview,
    lifecycleStatus,
    nextBorrowerAction: resolveNextBorrowerAction({ borrowerAcceptedQuote, quote, supplierPositions }),
    nextSupplierOperatorAction: resolveNextSupplierOperatorAction({ quote, fundingRoute, supplierPositions }),
    timestamps: {
      createdAt: now,
      quoteCreatedAt: now,
      quoteAcceptedAt: borrowerAcceptedQuote ? now : undefined,
      lastUpdatedAt: now,
    },
    quote,
    collateralLock: {
      status: borrowerAcceptedQuote && supplierPositions.length > 0 ? "awaiting_borrower" : "not_started",
      detail: "Borrower collateral lock is modeled but not watcher- or wallet-backed yet.",
      updatedAt: now,
    },
    dcrPlatformFeeOutput: {
      status: "previewed",
      detail: "DCR platform fee output is calculated for planning only; no transaction construction or routing is active.",
      updatedAt: now,
    },
    supplierDisbursement: {
      status: supplierPositions.length > 0 ? "ready" : quote.supplierFillCount > 0 ? "awaiting_funding" : "not_started",
      detail: "Supplier disbursement awaits future wallet funding and broadcast boundaries.",
      updatedAt: now,
    },
    repaymentDetection: {
      status: repaymentAllocationPreview.allocations.length > 0 ? "watcher_placeholder" : "not_started",
      detail: "Repayment detection is a deterministic preview until chain watcher events are introduced.",
      updatedAt: now,
    },
    collateralRelease: {
      status: "blocked",
      detail: "Collateral release is blocked until repayment detection and arbiter review paths are implemented.",
      updatedAt: now,
    },
    liquidationHealth: {
      status: "healthy",
      detail: "Liquidation health is a typed placeholder; production execution is intentionally disabled.",
      updatedAt: now,
    },
    arbiterReview: {
      status: "available",
      detail: "Arbiter review is modeled for future dispute, release, and liquidation workflows.",
      updatedAt: now,
    },
    evidenceBundle: {
      status: "placeholder",
      detail: "Evidence bundle placeholder exists for future audit and commitment work. Timestamping anchors evidence hashes only and does not decide liquidation.",
      updatedAt: now,
      commitmentScheme: "sha256_placeholder",
      bundleId: `evidence-${publicLoanReference.toLowerCase()}`,
      timestamp: emptyEvidenceTimestampAnchor,
    },
    fundingRoute,
  };
}

export function findHeadlessLoanLifecycleByLookupCode(
  lookupCode: string,
  records: HeadlessLoanLifecycleRecord[],
): HeadlessLoanLifecycleRecord | null {
  const normalized = lookupCode.trim().toUpperCase();
  if (!normalized) return null;
  return records.find((record) => record.lookupCode.toUpperCase() === normalized) ?? null;
}

function normalizeBorrowerContact(contact?: Partial<OptionalBorrowerContact>): OptionalBorrowerContact {
  if (!contact?.value) {
    return {
      preference: "none",
      consentForUpdates: false,
      note: "Borrower skipped contact info; lookup code is the recovery path.",
    };
  }

  return {
    preference: contact.preference ?? "email",
    value: contact.value,
    consentForUpdates: contact.consentForUpdates ?? true,
    note: "Optional borrower contact is for updates and recovery only, not account creation.",
  };
}

function resolveFundingRoute(input: {
  quote: BorrowerProtocolQuoteSummary;
  requestedAmountUsd: number;
}): FundingRouteStatus {
  const overTreasuryThreshold = input.requestedAmountUsd >= treasuryRequestThresholdUsd;
  const hasSupplierFills = input.quote.supplierFillCount > 0;
  const fullySupplierFunded = input.quote.fundingStatus === "funded";
  const status: FundingRouteKind = !hasSupplierFills
    ? overTreasuryThreshold
      ? "treasury_review"
      : "waiting_for_liquidity"
    : fullySupplierFunded && !overTreasuryThreshold
      ? "supplier_pool"
      : overTreasuryThreshold && hasSupplierFills
        ? "mixed_supplier_treasury"
        : "supplier_pool";

  return {
    status,
    detail:
      status === "treasury_review"
        ? "Requested amount meets the treasury/public funding review placeholder threshold. No submission is created yet."
        : status === "mixed_supplier_treasury"
          ? "Supplier liquidity is present, and the requested amount may also require treasury/public funding review."
          : status === "waiting_for_liquidity"
            ? "No matching supplier liquidity is available yet."
            : "Supplier pool route is sufficient for the current quote preview.",
    updatedAt: DEFAULT_NOW,
    treasuryRequestThresholdUsd,
    requestedAmountUsd: input.requestedAmountUsd,
    supplierFilledAmount: input.quote.supplierFilledAmount,
    treasuryReviewRequired: overTreasuryThreshold,
  };
}

function resolveLifecycleStatus(input: {
  borrowerAcceptedQuote: boolean;
  quote: BorrowerProtocolQuoteSummary;
  supplierPositions: SupplierPositionPreview[];
}): HeadlessLoanLifecycleStatus {
  if (!input.borrowerAcceptedQuote) return "quote_created";
  if (input.quote.supplierFillCount === 0) return "awaiting_liquidity";
  if (input.supplierPositions.length === 0) return "quote_accepted";
  return "awaiting_collateral_lock";
}

function resolveNextBorrowerAction(input: {
  borrowerAcceptedQuote: boolean;
  quote: BorrowerProtocolQuoteSummary;
  supplierPositions: SupplierPositionPreview[];
}): string {
  if (!input.borrowerAcceptedQuote) return "Accept the quote to receive a public loan reference and optional contact step.";
  if (input.quote.supplierFillCount === 0) return "Save the lookup code and wait for matching supplier liquidity.";
  if (input.supplierPositions.length === 0) return "Accept partial funding if desired, or wait for full supplier liquidity.";
  return "Save the lookup code, then prepare for collateral lock once wallet funding is available.";
}

function resolveNextSupplierOperatorAction(input: {
  quote: BorrowerProtocolQuoteSummary;
  fundingRoute: FundingRouteStatus;
  supplierPositions: SupplierPositionPreview[];
}): string {
  if (input.fundingRoute.status === "treasury_review") return "Review whether this request should enter a treasury/public funding path.";
  if (input.fundingRoute.status === "mixed_supplier_treasury") return "Review supplier fills and treasury/public funding eligibility before disbursement.";
  if (input.quote.supplierFillCount === 0) return "Add or activate supplier liquidity matching this borrow request.";
  if (input.supplierPositions.length === 0) return "Hold supplier fills until borrower accepts funded or partial terms.";
  return "Review supplier positions and prepare disbursement once collateral lock is confirmed.";
}

function createPublicLoanReference(asset: Loan["borrowAsset"], amount: number, now: string): string {
  const compactDate = now.slice(2, 10).replaceAll("-", "");
  return `DCL-${compactDate}-${asset}-${Math.round(amount)}`;
}

function estimateRequestedAmountUsd(amount: number, asset: Loan["borrowAsset"]): number {
  if (asset === "BTC") return amount * 100_000;
  return amount;
}
