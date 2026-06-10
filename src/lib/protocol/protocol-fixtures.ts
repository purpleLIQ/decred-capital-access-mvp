import {
  createCollateralContractTemplate,
  DEFAULT_SIMNET_COLLATERAL_POLICY,
  type CollateralContractTemplate,
} from "./collateral-templates";
import {
  createDecredEvidenceCommitmentRecord,
  createEvidenceHashCommitment,
  markEvidenceCommitmentAnchored,
  type DecredEvidenceCommitmentRecord,
  type EvidenceBundle,
  type EvidenceHashCommitment,
} from "./evidence";
import type { InterestRateConfig } from "./interest-rates";
import {
  createLoanQuote,
  type LoanQuote,
} from "./loan-quotes";
import type { LoanRequest } from "./loan-requests";
import { calculatePlatformFeeBreakdown } from "./platform-fees";
import type { SupplierFill } from "./supplier-offers";
import {
  createBorrowAssetDisbursementObservation,
  createDecredCollateralLockObservation,
  type BorrowAssetDisbursementObservation,
  type DecredCollateralLockObservation,
} from "./watcher-interfaces";

export interface ProtocolFixtureScenario {
  loanRequest: LoanRequest;
  fills: SupplierFill[];
  quote: LoanQuote;
  evidenceBundle: EvidenceBundle;
  evidenceCommitment: EvidenceHashCommitment;
  evidenceRecord: DecredEvidenceCommitmentRecord;
  collateralTemplate: CollateralContractTemplate;
  collateralObservation: DecredCollateralLockObservation;
  disbursementObservations: BorrowAssetDisbursementObservation[];
}

export function createProtocolFixtureScenario(): ProtocolFixtureScenario {
  const createdAt = "2026-06-10T12:00:00.000Z";
  const observedAt = "2026-06-10T12:05:00.000Z";
  const loanRequest: LoanRequest = {
    id: "loan-request-fixture-1",
    borrowerId: "borrower-fixture-1",
    borrowAsset: "BTC",
    borrowAmount: 1,
    collateralAsset: "DCR",
    collateralAmount: 100,
    durationDays: 365,
    requiredFundingThresholdBps: 10_000,
    createdAt,
    fundingDeadline: "2026-06-11T12:00:00.000Z",
    borrowerAcceptedPartialFunding: false,
  };
  const fills: SupplierFill[] = [
    {
      id: "fill-fixture-1",
      loanRequestId: loanRequest.id,
      supplierOfferId: "offer-fixture-1",
      supplierId: "supplier-fixture-1",
      borrowAsset: "BTC",
      amount: 1,
      aprBps: 1000,
      status: "reserved",
      reservedAt: "2026-06-10T12:01:00.000Z",
    },
  ];
  const interestRateConfig: InterestRateConfig = {
    borrowAsset: "BTC",
    minimumAprBps: 500,
    maximumAprBps: 2500,
    protocolSpreadBps: 100,
    durationPremiumBps: 25,
    collateralRiskPremiumBps: 75,
  };
  const quote = createLoanQuote({ request: loanRequest, fills, interestRateConfig });
  const platformFee = calculatePlatformFeeBreakdown(loanRequest.collateralAmount);
  const evidenceBundle: EvidenceBundle = {
    id: "evidence-fixture-1",
    loanId: "loan-fixture-1",
    decisionId: "decision-fixture-1",
    policyVersion: "fixture-policy-v0",
    createdAt: observedAt,
    collateralAsset: loanRequest.collateralAsset,
    collateralAmount: loanRequest.collateralAmount,
    borrowAsset: loanRequest.borrowAsset,
    borrowAmount: loanRequest.borrowAmount,
    oracleSnapshots: [
      {
        source: "fixture-oracle",
        observedAt,
        dcrUsdPrice: 200,
        borrowAssetUsdPrice: 12_000,
        healthy: true,
      },
    ],
    ltvBps: 6000,
    warningThresholdBps: 6500,
    liquidationThresholdBps: 8500,
    graceWindowOpen: false,
    arbiterWindowOpen: false,
    watcherConfirmations: 6,
    transactionTemplateIds: ["fixture-template-1"],
    blockers: [],
    warnings: ["Fixture only."],
    recommendedAction: "none",
    status: "ready_for_review",
  };
  const evidenceCommitment = createEvidenceHashCommitment(evidenceBundle);
  const evidenceRecord = markEvidenceCommitmentAnchored({
    record: createDecredEvidenceCommitmentRecord({
      id: "commitment-fixture-1",
      commitment: evidenceCommitment,
      network: "decred_simnet",
      preparedAt: observedAt,
    }),
    anchoredTxid: "fixture-evidence-txid",
    anchoredAt: observedAt,
    blockHeight: 123,
  });
  const collateralTemplate = createCollateralContractTemplate({
    id: "collateral-template-fixture-1",
    loanId: "loan-fixture-1",
    collateralAsset: "DCR",
    collateralAmount: loanRequest.collateralAmount,
    escrowAddress: "DsFixtureEscrow",
    participantKeys: {
      borrowerPubkey: "fixture-borrower-pubkey",
      supplierPubkey: "fixture-supplier-pubkey",
      arbiterPubkey: "fixture-arbiter-pubkey",
    },
    platformFee,
    platformFeeAddress: "DsFixturePlatformFee",
    arbiterReserveAddress: "DsFixtureArbiterReserve",
    evidenceCommitment: evidenceRecord,
    policy: DEFAULT_SIMNET_COLLATERAL_POLICY,
    createdAt,
  });
  const collateralObservation = createDecredCollateralLockObservation({
    id: "collateral-watch-fixture-1",
    expectation: {
      loanId: "loan-fixture-1",
      collateralAsset: "DCR",
      collateralAmount: loanRequest.collateralAmount,
      escrowAddress: "DsFixtureEscrow",
      platformFee,
      platformFeeAddress: "DsFixturePlatformFee",
    },
    reference: {
      network: "decred_simnet",
      txid: "fixture-collateral-txid",
      confirmations: 6,
      observedAt,
    },
    policy: { requiredConfirmations: 6, staleAfterBlocks: 12, allowMainnet: false },
    collateralOutputFound: true,
    collateralAmount: loanRequest.collateralAmount,
    escrowAddress: "DsFixtureEscrow",
    platformFeeOutputFound: true,
    platformFeeAmount: platformFee.totalFeeAmount,
    platformFeeAddress: "DsFixturePlatformFee",
    observedAt,
  });
  const disbursementObservations = [
    createBorrowAssetDisbursementObservation({
      id: "disbursement-watch-fixture-1",
      expectation: {
        loanId: "loan-fixture-1",
        borrowAsset: "BTC",
        supplierId: "supplier-fixture-1",
        expectedAmount: 1,
        borrowerReceiveAddress: "tb1fixtureborrower",
      },
      reference: {
        network: "bitcoin_testnet",
        txid: "fixture-disbursement-txid",
        confirmations: 3,
        observedAt,
      },
      policy: { requiredConfirmations: 3, staleAfterBlocks: 12, allowMainnet: false },
      amount: 1,
      borrowerReceiveAddress: "tb1fixtureborrower",
      outputFound: true,
      observedAt,
    }),
  ];

  return {
    loanRequest,
    fills,
    quote,
    evidenceBundle,
    evidenceCommitment,
    evidenceRecord,
    collateralTemplate,
    collateralObservation,
    disbursementObservations,
  };
}
