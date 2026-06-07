import { DemoDecredAdapter } from "./adapters/decred-adapter";
import { SimnetDecredAdapter } from "./adapters/simnet-decred-adapter";
import type {
  DecredLendingAdapter,
  DecredNetworkMode,
  TransactionPurpose,
  TransactionReview,
  UnsignedTransactionPreview,
} from "./adapters/decred-types";
import { demoMarketSnapshot } from "./fixtures";
import { evaluateLiquidationAutomation, type LiquidationDecision } from "./liquidation-policy";
import type { Loan, MarketSnapshot } from "./types";

export type ApprovalRole = "borrower" | "lender" | "arbiter" | "operator";
export type ReviewableNetworkMode = Extract<DecredNetworkMode, "demo" | "simnet">;
export type TransactionReviewStatus = "blocked" | "draft" | "ready_for_signing";

export interface ApprovalState {
  borrower: boolean;
  lender: boolean;
  arbiter: boolean;
  operator: boolean;
}

export interface SigningBoundary {
  canSign: false;
  canBroadcast: false;
  storesPrivateKeys: false;
  rawTransactionHexPresent: boolean;
  privateKeyHandling: "none";
  broadcastHandling: "disabled";
}

export interface TransactionReviewEnvelope {
  id: string;
  loanId: string;
  loanRef: string;
  purpose: TransactionPurpose;
  purposeLabel: string;
  network: ReviewableNetworkMode;
  status: TransactionReviewStatus;
  summary: string;
  adapterReview: TransactionReview;
  unsignedTransaction: UnsignedTransactionPreview | null;
  approvals: ApprovalState;
  requiredApprovals: ApprovalRole[];
  blockers: string[];
  warnings: string[];
  signingBoundary: SigningBoundary;
  liquidationDecision?: LiquidationDecision;
  createdAt: string;
}

export interface CreateTransactionReviewInput {
  loan: Loan;
  purpose: TransactionPurpose;
  network?: ReviewableNetworkMode;
  approvals?: Partial<ApprovalState>;
  market?: MarketSnapshot;
  dexDepthUsd?: number;
  minutesSinceWarning?: number;
  now?: string;
}

const emptyApprovals: ApprovalState = {
  borrower: false,
  lender: false,
  arbiter: false,
  operator: false,
};

const purposeLabels: Record<TransactionPurpose, string> = {
  collateral_deposit: "Collateral deposit review",
  loan_payout: "Loan payout review",
  collateral_release: "Collateral release review",
  liquidation: "Liquidation transaction review",
};

const requiredApprovalsByPurpose: Record<TransactionPurpose, ApprovalRole[]> = {
  collateral_deposit: ["borrower", "operator"],
  loan_payout: ["lender", "operator"],
  collateral_release: ["borrower", "lender", "operator"],
  liquidation: ["lender", "arbiter", "operator"],
};

const purposeWarnings: Record<TransactionPurpose, string[]> = {
  collateral_deposit: [
    "Deposit review verifies destination, confirmations, and escrow metadata only; it does not sign or broadcast.",
  ],
  loan_payout: [
    "Payout review must remain separate from Decred collateral signing and should require lender/operator approval.",
  ],
  collateral_release: [
    "Release review must prove repayment and collect non-custodial signatures before any real broadcast.",
    "Arbiter participation is a fallback path and should be auditable.",
  ],
  liquidation: [
    "Liquidation review is a queueable automation decision, not liquidation execution.",
    "Production must not rely on a human remembering to liquidate, but signing and broadcast remain gated.",
  ],
};

export function createTransactionReviewEnvelope(input: CreateTransactionReviewInput): TransactionReviewEnvelope {
  const network = input.network ?? "demo";
  const adapter = adapterForNetwork(network);
  const adapterReview = adapter.createTransactionReview(input.loan, input.purpose);
  const approvals = normalizeApprovals(input.approvals);
  const requiredApprovals = requiredApprovalsForPurpose(input.purpose);
  const warnings = [...purposeWarnings[input.purpose]];
  const blockers = new Set<string>(adapterReview.blockers);
  let liquidationDecision: LiquidationDecision | undefined;

  if (network === "demo") {
    blockers.add("Demo reviews cannot move to signing because demo mode has no wallet RPC or raw transaction builder.");
  }

  if (network === "simnet") {
    blockers.add("Simnet reviews cannot move to signing until wallet RPC and unsigned transaction construction are implemented.");
  }

  if (!adapter.canSign) {
    blockers.add("Adapter signing is disabled by design.");
  }

  if (!adapter.canBroadcast) {
    blockers.add("Broadcast is disabled by design.");
  }

  if (adapterReview.unsignedTransaction?.rawTransactionHex && network === "demo") {
    blockers.add("Demo mode must not produce raw transaction hex.");
  }

  if (input.purpose === "liquidation") {
    liquidationDecision = evaluateLiquidationAutomation({
      loan: input.loan,
      market: input.market ?? demoMarketSnapshot,
      dexDepthUsd: input.dexDepthUsd ?? 0,
      minutesSinceWarning: input.minutesSinceWarning ?? 0,
    });

    for (const reason of liquidationDecision.reasons) {
      warnings.push(reason);
    }

    for (const blocker of liquidationDecision.blockers) {
      blockers.add(blocker);
    }

    if (liquidationDecision.action !== "auto_liquidate") {
      blockers.add("Liquidation policy has not authorized an automated liquidation transaction review.");
    }
  }

  const unsignedTransaction = adapterReview.unsignedTransaction;
  const signingBoundary: SigningBoundary = {
    canSign: false,
    canBroadcast: false,
    storesPrivateKeys: false,
    rawTransactionHexPresent: Boolean(unsignedTransaction?.rawTransactionHex),
    privateKeyHandling: "none",
    broadcastHandling: "disabled",
  };

  const reviewWithoutStatus: Omit<TransactionReviewEnvelope, "status"> = {
    id: `txreview_${network}_${input.loan.id}_${input.purpose}`,
    loanId: input.loan.id,
    loanRef: input.loan.ref,
    purpose: input.purpose,
    purposeLabel: purposeLabels[input.purpose],
    network,
    summary: adapterReview.summary,
    adapterReview,
    unsignedTransaction,
    approvals,
    requiredApprovals,
    blockers: [...blockers],
    warnings,
    signingBoundary,
    liquidationDecision,
    createdAt: input.now ?? new Date().toISOString(),
  };

  const draftReview: TransactionReviewEnvelope = {
    ...reviewWithoutStatus,
    status: reviewWithoutStatus.blockers.length > 0 ? "blocked" : "draft",
  };

  return {
    ...draftReview,
    status:
      draftReview.blockers.length === 0 && isReviewFullyApproved(draftReview) && isUnsignedTransactionReady(draftReview)
        ? "ready_for_signing"
        : draftReview.status,
  };
}

export function canMoveToSigning(review: TransactionReviewEnvelope): boolean {
  return (
    review.status === "ready_for_signing" &&
    review.blockers.length === 0 &&
    isReviewFullyApproved(review) &&
    isUnsignedTransactionReady(review) &&
    !review.signingBoundary.canSign &&
    !review.signingBoundary.canBroadcast &&
    !review.signingBoundary.storesPrivateKeys
  );
}

export function isReviewFullyApproved(review: Pick<TransactionReviewEnvelope, "approvals" | "requiredApprovals">): boolean {
  return review.requiredApprovals.every((role) => review.approvals[role]);
}

export function requiredApprovalsForPurpose(purpose: TransactionPurpose): ApprovalRole[] {
  return requiredApprovalsByPurpose[purpose];
}

export function purposeLabel(purpose: TransactionPurpose): string {
  return purposeLabels[purpose];
}

export function normalizeApprovals(approvals?: Partial<ApprovalState>): ApprovalState {
  return { ...emptyApprovals, ...approvals };
}

function isUnsignedTransactionReady(review: TransactionReviewEnvelope): boolean {
  return Boolean(review.unsignedTransaction?.rawTransactionHex);
}

function adapterForNetwork(network: ReviewableNetworkMode): DecredLendingAdapter {
  if (network === "simnet") return new SimnetDecredAdapter();
  return new DemoDecredAdapter();
}
