import { describe, expect, it } from "vitest";

import {
  calculatePlatformFeeBreakdown,
  createArbiterCase,
  createBorrowAssetDisbursementObservation,
  createCollateralContractTemplate,
  createDecredCollateralLockObservation,
  createDecredEvidenceCommitmentRecord,
  createEvidenceHashCommitment,
  DEFAULT_SIMNET_COLLATERAL_POLICY,
  evaluateFallbackReadiness,
  evaluateLoanHealth,
  markEvidenceCommitmentAnchored,
  type EvidenceBundle,
  type FallbackReadinessInput,
} from "..";

const now = "2026-06-10T12:00:00.000Z";
const observedAt = "2026-06-10T11:59:00.000Z";
const platformFee = calculatePlatformFeeBreakdown(100);
const bundle: EvidenceBundle = {
  id: "evidence-1",
  loanId: "loan-1",
  decisionId: "decision-1",
  policyVersion: "policy-v0",
  createdAt: observedAt,
  collateralAsset: "DCR",
  collateralAmount: 100,
  borrowAsset: "BTC",
  borrowAmount: 1,
  oracleSnapshots: [],
  ltvBps: 8750,
  warningThresholdBps: 6500,
  liquidationThresholdBps: 7500,
  graceWindowOpen: false,
  arbiterWindowOpen: true,
  watcherConfirmations: 6,
  transactionTemplateIds: ["template-1"],
  blockers: [],
  warnings: [],
  recommendedAction: "fallback_liquidation_review",
  status: "ready_for_review",
};
const commitment = createEvidenceHashCommitment(bundle);
const record = markEvidenceCommitmentAnchored({
  record: createDecredEvidenceCommitmentRecord({ id: "record-1", commitment, network: "decred_simnet", preparedAt: observedAt }),
  anchoredTxid: "dcr-evidence-tx",
  anchoredAt: now,
  blockHeight: 100,
});

function buildInput(): FallbackReadinessInput {
  const healthEvaluation = evaluateLoanHealth({
    loanId: "loan-1",
    collateralAsset: "DCR",
    collateralAmount: 100,
    borrowAsset: "BTC",
    borrowAmount: 1,
    collateralPrices: [{ source: "oracle-1", observedAt, asset: "DCR", usdPrice: 200 }],
    borrowAssetPrices: [{ source: "oracle-1", observedAt, asset: "BTC", usdPrice: 17_500 }],
    now,
    config: {
      policyVersion: "policy-v0",
      maxOracleAgeMs: 300_000,
      maxSourceDivergenceBps: 500,
      warningLtvBps: 6500,
      topUpLtvBps: 7000,
      arbiterReviewLtvBps: 7500,
      fallbackReviewLtvBps: 8500,
      automaticFallbackEnabled: false,
    },
  });
  const collateralObservation = createCollateralObservation(6);
  const disbursementObservation = createBorrowAssetDisbursementObservation({
    id: "disbursement-watch-1",
    expectation: { loanId: "loan-1", borrowAsset: "BTC", supplierId: "supplier-1", expectedAmount: 1, borrowerReceiveAddress: "tb1borrower" },
    reference: { network: "bitcoin_testnet", txid: "btc-disbursement-tx", confirmations: 3, observedAt },
    policy: { requiredConfirmations: 3, staleAfterBlocks: 12, allowMainnet: false },
    amount: 1,
    borrowerReceiveAddress: "tb1borrower",
    outputFound: true,
    observedAt,
  });
  const arbiterCase = createArbiterCase({
    id: "case-1",
    loanId: "loan-1",
    openedAt: now,
    healthEvaluation,
    collateralObservation,
    disbursementObservations: [disbursementObservation],
    evidenceCommitment: commitment,
    commitmentRecord: record,
  });

  return {
    loanId: "loan-1",
    network: "decred_simnet",
    healthEvaluation,
    arbiterCase,
    collateralTemplate: createCollateralContractTemplate({
      id: "template-1",
      loanId: "loan-1",
      collateralAsset: "DCR",
      collateralAmount: 100,
      escrowAddress: "DsEscrow",
      participantKeys: { borrowerPubkey: "borrower", supplierPubkey: "supplier", arbiterPubkey: "arbiter" },
      platformFee,
      platformFeeAddress: "DsPlatformFee",
      arbiterReserveAddress: "DsArbiterReserve",
      evidenceCommitment: record,
      policy: DEFAULT_SIMNET_COLLATERAL_POLICY,
      createdAt: now,
    }),
    collateralObservation,
    disbursementObservations: [disbursementObservation],
    evidenceCommitmentRecord: record,
    transactionTemplateReview: { id: "tx-review-1", templateKind: "fallback_liquidation_review", unsignedPreviewAvailable: true, reviewedByOperator: true },
    manualOperatorReview: { reviewerId: "operator-1", reviewedAt: now, approved: true, notes: ["reviewed"] },
  };
}

function createCollateralObservation(confirmations: number) {
  return createDecredCollateralLockObservation({
    id: "collateral-watch-1",
    expectation: { loanId: "loan-1", collateralAsset: "DCR", collateralAmount: 100, escrowAddress: "DsEscrow", platformFee, platformFeeAddress: "DsPlatformFee" },
    reference: { network: "decred_simnet", txid: "dcr-collateral-tx", confirmations, observedAt },
    policy: { requiredConfirmations: 6, staleAfterBlocks: 12, allowMainnet: false },
    collateralOutputFound: true,
    collateralAmount: 100,
    escrowAddress: "DsEscrow",
    platformFeeOutputFound: true,
    platformFeeAmount: 1,
    platformFeeAddress: "DsPlatformFee",
    observedAt,
  });
}

describe("fallback readiness gates", () => {
  it("passes all gates for manual simnet review only", () => {
    const review = evaluateFallbackReadiness(buildInput());

    expect(review.decision).toBe("ready_for_manual_simnet_review");
    expect(review.canExecute).toBe(false);
    expect(review.blockers).toEqual([]);
  });

  it("blocks outside simnet", () => {
    const review = evaluateFallbackReadiness({ ...buildInput(), network: "decred_testnet" });

    expect(review.decision).toBe("blocked");
    expect(review.blockers).toContain("Fallback readiness review is limited to simnet.");
  });

  it("blocks without transaction review", () => {
    const input = buildInput();
    delete input.transactionTemplateReview;

    expect(evaluateFallbackReadiness(input).blockers).toContain("Transaction template review is required.");
  });

  it("blocks without manual approval", () => {
    const review = evaluateFallbackReadiness({ ...buildInput(), manualOperatorReview: { approved: false, notes: [] } });

    expect(review.blockers).toContain("Manual operator approval is required.");
  });

  it("blocks when collateral observation is short of confirmations", () => {
    const review = evaluateFallbackReadiness({ ...buildInput(), collateralObservation: createCollateralObservation(1) });

    expect(review.blockers).toContain("Collateral observation is observed.");
  });
});
