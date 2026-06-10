import { describe, expect, it } from "vitest";

import {
  calculatePlatformFeeBreakdown,
  createArbiterCase,
  createBorrowAssetDisbursementObservation,
  createDecredCollateralLockObservation,
  createDecredEvidenceCommitmentRecord,
  createEvidenceHashCommitment,
  evaluateLoanHealth,
  markEvidenceCommitmentAnchored,
  transitionArbiterCase,
  type EvidenceBundle,
} from "..";

const now = "2026-06-10T12:00:00.000Z";
const observedAt = "2026-06-10T11:59:00.000Z";
const evidenceBundle: EvidenceBundle = {
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
  ltvBps: 7600,
  warningThresholdBps: 6500,
  liquidationThresholdBps: 7500,
  graceWindowOpen: false,
  arbiterWindowOpen: true,
  watcherConfirmations: 6,
  transactionTemplateIds: ["template-1"],
  blockers: [],
  warnings: [],
  recommendedAction: "arbiter_review",
  status: "ready_for_review",
};

const commitment = createEvidenceHashCommitment(evidenceBundle);
const anchoredRecord = markEvidenceCommitmentAnchored({
  record: createDecredEvidenceCommitmentRecord({
    id: "record-1",
    commitment,
    network: "decred_simnet",
    preparedAt: observedAt,
  }),
  anchoredTxid: "dcr-evidence-tx",
  anchoredAt: now,
  blockHeight: 100,
});

function healthEvaluation(btcPrice: number) {
  return evaluateLoanHealth({
    loanId: "loan-1",
    collateralAsset: "DCR",
    collateralAmount: 100,
    borrowAsset: "BTC",
    borrowAmount: 1,
    collateralPrices: [{ source: "oracle-1", observedAt, asset: "DCR", usdPrice: 200 }],
    borrowAssetPrices: [{ source: "oracle-1", observedAt, asset: "BTC", usdPrice: btcPrice }],
    now,
    config: {
      policyVersion: "policy-v0",
      maxOracleAgeMs: 5 * 60 * 1000,
      maxSourceDivergenceBps: 500,
      warningLtvBps: 6500,
      topUpLtvBps: 7000,
      arbiterReviewLtvBps: 7500,
      fallbackReviewLtvBps: 8500,
      automaticFallbackEnabled: false,
    },
  });
}

function collateralObservation() {
  return createDecredCollateralLockObservation({
    id: "collateral-watch-1",
    expectation: {
      loanId: "loan-1",
      collateralAsset: "DCR",
      collateralAmount: 100,
      escrowAddress: "DsEscrow",
      platformFee: calculatePlatformFeeBreakdown(100),
      platformFeeAddress: "DsPlatformFee",
    },
    reference: {
      network: "decred_simnet",
      txid: "dcr-collateral-tx",
      confirmations: 6,
      observedAt,
    },
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

function disbursementObservation() {
  return createBorrowAssetDisbursementObservation({
    id: "disbursement-watch-1",
    expectation: {
      loanId: "loan-1",
      borrowAsset: "BTC",
      supplierId: "supplier-1",
      expectedAmount: 1,
      borrowerReceiveAddress: "tb1borrower",
    },
    reference: {
      network: "bitcoin_testnet",
      txid: "btc-disbursement-tx",
      confirmations: 3,
      observedAt,
    },
    policy: { requiredConfirmations: 3, staleAfterBlocks: 12, allowMainnet: false },
    amount: 1,
    borrowerReceiveAddress: "tb1borrower",
    outputFound: true,
    observedAt,
  });
}

describe("arbiter state scaffolding", () => {
  it("opens awaiting evidence when required evidence is missing", () => {
    const arbiterCase = createArbiterCase({
      id: "case-1",
      loanId: "loan-1",
      openedAt: now,
    });

    expect(arbiterCase.status).toBe("awaiting_evidence");
    expect(arbiterCase.recommendedDecision).toBe("request_more_evidence");
    expect(arbiterCase.fallbackExecutionAllowed).toBe(false);
    expect(arbiterCase.blockers).toContain("Oracle health evaluation is required.");
  });

  it("becomes ready for review when all evidence is accepted", () => {
    const arbiterCase = createArbiterCase({
      id: "case-2",
      loanId: "loan-1",
      openedAt: now,
      healthEvaluation: healthEvaluation(15_200),
      collateralObservation: collateralObservation(),
      disbursementObservations: [disbursementObservation()],
      evidenceCommitment: commitment,
      commitmentRecord: anchoredRecord,
    });

    expect(arbiterCase.status).toBe("ready_for_review");
    expect(arbiterCase.recommendedDecision).toBe("approve_supplier_claim");
    expect(arbiterCase.blockers).toEqual([]);
    expect(arbiterCase.evidenceItems.every((item) => item.status === "accepted")).toBe(true);
  });

  it("blocks fallback review instead of allowing execution", () => {
    const arbiterCase = createArbiterCase({
      id: "case-3",
      loanId: "loan-1",
      openedAt: now,
      healthEvaluation: healthEvaluation(17_500),
      collateralObservation: collateralObservation(),
      disbursementObservations: [disbursementObservation()],
      evidenceCommitment: commitment,
      commitmentRecord: anchoredRecord,
    });

    expect(arbiterCase.status).toBe("fallback_review_blocked");
    expect(arbiterCase.recommendedDecision).toBe("block_fallback");
    expect(arbiterCase.fallbackExecutionAllowed).toBe(false);
    expect(arbiterCase.warnings).toContain("Fallback review threshold reached, but execution remains disabled.");
  });

  it("requests more evidence when the commitment record is not anchored", () => {
    const unanchoredRecord = createDecredEvidenceCommitmentRecord({
      id: "record-2",
      commitment,
      network: "decred_simnet",
      preparedAt: observedAt,
    });
    const arbiterCase = createArbiterCase({
      id: "case-4",
      loanId: "loan-1",
      openedAt: now,
      healthEvaluation: healthEvaluation(15_200),
      collateralObservation: collateralObservation(),
      disbursementObservations: [disbursementObservation()],
      evidenceCommitment: commitment,
      commitmentRecord: unanchoredRecord,
    });

    expect(arbiterCase.status).toBe("needs_more_evidence");
    expect(arbiterCase.blockers).toContain("Evidence commitment record is not anchored.");
  });

  it("transitions to explicit borrower release approval", () => {
    const arbiterCase = createArbiterCase({
      id: "case-5",
      loanId: "loan-1",
      openedAt: now,
      healthEvaluation: healthEvaluation(10_000),
      collateralObservation: collateralObservation(),
      disbursementObservations: [disbursementObservation()],
      evidenceCommitment: commitment,
      commitmentRecord: anchoredRecord,
    });
    const transitioned = transitionArbiterCase({
      arbiterCase,
      decision: "approve_borrower_release",
      decidedAt: now,
      note: "Borrower release approved after review.",
    });

    expect(transitioned.status).toBe("borrower_release_approved");
    expect(transitioned.recommendedDecision).toBe("approve_borrower_release");
    expect(transitioned.warnings).toContain("Borrower release approved after review.");
    expect(transitioned.fallbackExecutionAllowed).toBe(false);
  });
});
