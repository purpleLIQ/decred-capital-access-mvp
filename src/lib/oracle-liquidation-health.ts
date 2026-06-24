import type {
  BorrowerWarningWindow,
  HeadlessLiquidationHealthStatus,
  HeadlessLoanLifecycleRecord,
  LifecycleOracleHealthSummary,
} from "./headless-loan-lifecycle";
import { createHeadlessLifecycleEvent, type HeadlessLifecycleEvent } from "./headless-lifecycle-events";
import type { Loan } from "./types";

export type OraclePriceAsset = "DCR" | Loan["borrowAsset"];
export type OracleAssetPair = "DCR/USD" | "BTC/USD" | "USDC/USD" | "USDT/USD";
export type OracleObservationSource = "fixture" | "operator" | "oracle_provider" | "system";
export type OracleQualityLevel = "high" | "medium" | "low" | "blocked";
export type OracleSafetyStatus = "fresh" | "stale" | "missing" | "deviated" | "blocked";
export type WatcherFreshnessRiskStatus = "fresh" | "stale" | "reorged" | "unfinalized" | "unknown";
export type RepaymentHealthStatus = "none" | "partial" | "repaid";

export interface OraclePriceObservation {
  observationId: string;
  observedAt: string;
  source: OracleObservationSource;
  providerId: string;
  providerName: string;
  assetPair: OracleAssetPair;
  price: number;
  quality: OracleQualityLevel;
  confidenceScore: number;
  freshnessStatus: OracleSafetyStatus;
  deviationStatus: OracleSafetyStatus;
  sourceCount: number;
  quorumStatus: OracleSafetyStatus;
  maxAgeMs: number;
  safetyAuditNote: string;
}

export interface OraclePolicyInput {
  borrowAsset: Loan["borrowAsset"];
  selectedDcrUsdPrice: number;
  selectedBorrowAssetUsdPrice: number;
  sourceCount: number;
  freshnessPassed: boolean;
  deviationPassed: boolean;
  quorumPassed: boolean;
  usable: boolean;
  blockerReason?: string;
  freshnessStatus: OracleSafetyStatus;
  deviationStatus: OracleSafetyStatus;
  quorumStatus: OracleSafetyStatus;
  selectedObservationIds: string[];
  observations: OraclePriceObservation[];
  auditNote: string;
}

export interface LiquidationHealthPolicyConfig {
  policyVersion: string;
  safeLtvBps: number;
  warningLtvBps: number;
  marginCallLtvBps: number;
  liquidationEligibleLtvBps: number;
  minimumOracleSourceCount: number;
  maxOracleAgeMs: number;
  maxAllowedDeviationBps: number;
  borrowerWarningWindowMinutes: number;
  topUpWindowMinutes: number;
  arbiterReviewWindowMinutes: number;
}

export interface LiquidationWatcherRiskInput {
  decredWatcher: WatcherFreshnessRiskStatus;
  borrowAssetWatcher: WatcherFreshnessRiskStatus;
  evidenceComplete: boolean;
  auditNote: string;
}

export interface LiquidationHealthEvidenceSummary {
  healthResultId: string;
  lookupCode: string;
  policyVersion: string;
  oracleObservationIds: string[];
  selectedDcrUsdPrice: number;
  selectedBorrowAssetUsdPrice: number;
  ltvBps: number;
  collateralizationBps: number;
  collateralValueUsd: number;
  debtValueUsd: number;
  thresholds: Pick<
    LiquidationHealthPolicyConfig,
    "safeLtvBps" | "warningLtvBps" | "marginCallLtvBps" | "liquidationEligibleLtvBps"
  >;
  watcherFreshnessSummary: string;
  repaymentSummary: string;
  borrowerSafeSummary: string;
  operatorInternalSummary: string;
  safetyAuditNote: string;
}

export interface LiquidationHealthResult {
  resultId: string;
  lookupCode: string;
  status: HeadlessLiquidationHealthStatus;
  lifecycleStatus: HeadlessLoanLifecycleRecord["liquidationHealth"]["status"];
  ltvBps: number;
  collateralizationBps: number;
  collateralValueUsd: number;
  debtValueUsd: number;
  priceInputsUsed: {
    dcrUsd: number;
    borrowAssetUsd: number;
    observationIds: string[];
  };
  oracleUsable: boolean;
  blockerReason?: string;
  borrowerSafeSummary: string;
  operatorInternalSummary: string;
  nextBorrowerAction: string;
  nextOperatorArbiterAction: string;
  shouldOpenArbiterReview: boolean;
  liquidationReviewEligible: boolean;
  automaticLiquidationBlocked: true;
  borrowerWarningWindow: BorrowerWarningWindow;
  policy: LiquidationHealthPolicyConfig;
  oracleInput: OraclePolicyInput;
  watcherRisk: LiquidationWatcherRiskInput;
  repaymentStatus: RepaymentHealthStatus;
  evidenceSummary: LiquidationHealthEvidenceSummary;
  createdAt: string;
}

export const DEFAULT_LIQUIDATION_HEALTH_POLICY: LiquidationHealthPolicyConfig = {
  policyVersion: "oracle-liquidation-health-v0-fixture",
  safeLtvBps: 5_000,
  warningLtvBps: 6_500,
  marginCallLtvBps: 7_500,
  liquidationEligibleLtvBps: 8_500,
  minimumOracleSourceCount: 2,
  maxOracleAgeMs: 5 * 60 * 1000,
  maxAllowedDeviationBps: 500,
  borrowerWarningWindowMinutes: 60,
  topUpWindowMinutes: 120,
  arbiterReviewWindowMinutes: 180,
};

export const DEFAULT_WATCHER_RISK: LiquidationWatcherRiskInput = {
  decredWatcher: "fresh",
  borrowAssetWatcher: "fresh",
  evidenceComplete: true,
  auditNote: "Fixture/manual watcher freshness input. No chain calls are made.",
};

export function createOraclePriceObservation(input: {
  observationId: string;
  observedAt: string;
  source?: OracleObservationSource;
  providerId?: string;
  providerName?: string;
  assetPair: OracleAssetPair;
  price: number;
  quality?: OracleQualityLevel;
  confidenceScore?: number;
  sourceCount?: number;
  maxAgeMs?: number;
  safetyAuditNote?: string;
}): OraclePriceObservation {
  return {
    observationId: input.observationId,
    observedAt: input.observedAt,
    source: input.source ?? "fixture",
    providerId: input.providerId ?? "fixture-provider",
    providerName: input.providerName ?? "Fixture oracle provider",
    assetPair: input.assetPair,
    price: input.price,
    quality: input.quality ?? "medium",
    confidenceScore: input.confidenceScore ?? 0.75,
    freshnessStatus: "fresh",
    deviationStatus: "fresh",
    sourceCount: input.sourceCount ?? 1,
    quorumStatus: "fresh",
    maxAgeMs: input.maxAgeMs ?? DEFAULT_LIQUIDATION_HEALTH_POLICY.maxOracleAgeMs,
    safetyAuditNote: input.safetyAuditNote ?? "Fixture/manual oracle observation. No live provider call or trading dependency is used.",
  };
}

export function buildOraclePolicyInput(input: {
  borrowAsset: Loan["borrowAsset"];
  observations: OraclePriceObservation[];
  now: string;
  policy?: LiquidationHealthPolicyConfig;
}): OraclePolicyInput {
  const policy = input.policy ?? DEFAULT_LIQUIDATION_HEALTH_POLICY;
  const dcrObservations = observationsForPair(input.observations, "DCR/USD");
  const borrowObservations = observationsForPair(input.observations, `${input.borrowAsset}/USD` as OracleAssetPair);
  const selectedDcrUsdPrice = median(dcrObservations.map((observation) => observation.price));
  const selectedBorrowAssetUsdPrice = median(borrowObservations.map((observation) => observation.price));
  const sourceCount = Math.min(dcrObservations.length, borrowObservations.length);
  const stale = [...dcrObservations, ...borrowObservations].some((observation) => observationAgeMs(observation, input.now) > policy.maxOracleAgeMs);
  const missing = dcrObservations.length === 0 || borrowObservations.length === 0;
  const dcrDeviationBps = calculateDeviationBps(dcrObservations.map((observation) => observation.price));
  const borrowDeviationBps = calculateDeviationBps(borrowObservations.map((observation) => observation.price));
  const deviated = dcrDeviationBps > policy.maxAllowedDeviationBps || borrowDeviationBps > policy.maxAllowedDeviationBps;
  const quorumPassed = sourceCount >= policy.minimumOracleSourceCount;
  const positivePrices = selectedDcrUsdPrice > 0 && selectedBorrowAssetUsdPrice > 0;
  const blockerReason = resolveOracleBlocker({
    missing,
    stale,
    deviated,
    quorumPassed,
    positivePrices,
    sourceCount,
    policy,
  });
  const usable = !blockerReason;

  return {
    borrowAsset: input.borrowAsset,
    selectedDcrUsdPrice,
    selectedBorrowAssetUsdPrice,
    sourceCount,
    freshnessPassed: !missing && !stale,
    deviationPassed: !deviated,
    quorumPassed,
    usable,
    blockerReason,
    freshnessStatus: missing ? "missing" : stale ? "stale" : "fresh",
    deviationStatus: missing ? "missing" : deviated ? "deviated" : "fresh",
    quorumStatus: missing ? "missing" : quorumPassed ? "fresh" : "blocked",
    selectedObservationIds: [...dcrObservations, ...borrowObservations].map((observation) => observation.observationId),
    observations: input.observations,
    auditNote: "Oracle policy input is deterministic fixture/manual scaffolding. It does not call live providers or authorize liquidation execution.",
  };
}

export function evaluateLiquidationHealth(input: {
  record: HeadlessLoanLifecycleRecord;
  oracleInput: OraclePolicyInput;
  now: string;
  policy?: LiquidationHealthPolicyConfig;
  repaymentStatus?: RepaymentHealthStatus;
  watcherRisk?: Partial<LiquidationWatcherRiskInput>;
  existingArbiterReviewStatus?: HeadlessLoanLifecycleRecord["arbiterReview"]["status"];
}): LiquidationHealthResult {
  const policy = input.policy ?? DEFAULT_LIQUIDATION_HEALTH_POLICY;
  const watcherRisk = { ...DEFAULT_WATCHER_RISK, ...input.watcherRisk };
  const repaymentStatus = input.repaymentStatus ?? repaymentStatusFromRecord(input.record);
  const collateralDcr = collateralDcrFromRecord(input.record);
  const collateralValueUsd = collateralDcr * input.oracleInput.selectedDcrUsdPrice;
  const debtValueUsd = input.record.requestedAmount * input.oracleInput.selectedBorrowAssetUsdPrice;
  const ltvBps = collateralValueUsd > 0 ? (debtValueUsd / collateralValueUsd) * 10_000 : 0;
  const collateralizationBps = debtValueUsd > 0 ? (collateralValueUsd / debtValueUsd) * 10_000 : 0;
  const blockerReason = input.oracleInput.blockerReason ?? watcherBlocker(watcherRisk);
  const status = resolveHealthStatus({
    ltvBps,
    blockerReason,
    repaymentStatus,
    arbiterReviewStatus: input.existingArbiterReviewStatus ?? input.record.arbiterReview.status,
    policy,
  });
  const warningWindow = createBorrowerWarningWindow({ status, ltvBps, collateralDcr, debtValueUsd, collateralValueUsd, policy, now: input.now });
  const shouldOpenArbiterReview = shouldOpenReview(status, blockerReason, watcherRisk);
  const liquidationReviewEligible = status === "liquidation_eligible" || status === "arbiter_window_open" || status === "liquidation_review";
  const resultId = createHealthResultId(input.record.lookupCode, input.now);
  const borrowerSafeSummary = borrowerSummaryForStatus(status, blockerReason);
  const operatorInternalSummary = operatorSummary({ status, ltvBps, blockerReason, watcherRisk, oracleInput: input.oracleInput });
  const evidenceSummary = createLiquidationHealthEvidenceSummary({
    resultId,
    record: input.record,
    status,
    ltvBps,
    collateralizationBps,
    collateralValueUsd,
    debtValueUsd,
    oracleInput: input.oracleInput,
    watcherRisk,
    repaymentStatus,
    borrowerSafeSummary,
    operatorInternalSummary,
    policy,
  });

  return {
    resultId,
    lookupCode: input.record.lookupCode,
    status,
    lifecycleStatus: status,
    ltvBps,
    collateralizationBps,
    collateralValueUsd,
    debtValueUsd,
    priceInputsUsed: {
      dcrUsd: input.oracleInput.selectedDcrUsdPrice,
      borrowAssetUsd: input.oracleInput.selectedBorrowAssetUsdPrice,
      observationIds: input.oracleInput.selectedObservationIds,
    },
    oracleUsable: input.oracleInput.usable && !watcherBlocker(watcherRisk),
    blockerReason,
    borrowerSafeSummary,
    operatorInternalSummary,
    nextBorrowerAction: borrowerActionForStatus(status),
    nextOperatorArbiterAction: operatorActionForStatus(status, blockerReason),
    shouldOpenArbiterReview,
    liquidationReviewEligible,
    automaticLiquidationBlocked: true,
    borrowerWarningWindow: warningWindow,
    policy,
    oracleInput: input.oracleInput,
    watcherRisk,
    repaymentStatus,
    evidenceSummary,
    createdAt: input.now,
  };
}

export function createLiquidationHealthLifecycleEvents(input: {
  record: HeadlessLoanLifecycleRecord;
  result: LiquidationHealthResult;
  includeOracleObservationEvent?: boolean;
}): HeadlessLifecycleEvent[] {
  const events: HeadlessLifecycleEvent[] = [];
  const result = input.result;

  if (input.includeOracleObservationEvent ?? true) {
    events.push(createHeadlessLifecycleEvent({
      lookupCode: input.record.lookupCode,
      kind: "oracle_price_observed",
      source: "oracle",
      observedAt: result.createdAt,
      createdAt: result.createdAt,
      externalReference: result.priceInputsUsed.observationIds[0],
      safetyAuditNote: "Oracle price observation is fixture/manual scaffolding only. No live oracle call, trading, signing, broadcast, or funds movement occurred.",
      payload: healthPayload(result, "Oracle price observations prepared for liquidation health policy."),
    }));
  }

  events.push(createHeadlessLifecycleEvent({
    lookupCode: input.record.lookupCode,
    kind: "liquidation_health_updated",
    source: "oracle",
    observedAt: result.createdAt,
    createdAt: result.createdAt,
    externalReference: result.resultId,
    safetyAuditNote: "Liquidation health update is review scaffolding only. Automatic liquidation remains blocked.",
    payload: healthPayload(result, result.operatorInternalSummary),
  }));

  if (["warning", "margin_call", "liquidation_eligible", "arbiter_window_open"].includes(result.status)) {
    events.push(createHeadlessLifecycleEvent({
      lookupCode: input.record.lookupCode,
      kind: "borrower_warning_opened",
      source: "oracle",
      observedAt: result.createdAt,
      createdAt: result.createdAt,
      externalReference: result.resultId,
      safetyAuditNote: "Borrower warning event does not execute top-up, signing, broadcast, liquidation, or funds movement.",
      payload: healthPayload(result, result.borrowerWarningWindow.borrowerSafeMessage),
    }));
  }

  if (result.borrowerWarningWindow.topUpRequested) {
    events.push(createHeadlessLifecycleEvent({
      lookupCode: input.record.lookupCode,
      kind: "top_up_requested",
      source: "oracle",
      observedAt: result.createdAt,
      createdAt: result.createdAt,
      externalReference: result.resultId,
      safetyAuditNote: "Top-up request is a placeholder warning only. No top-up watcher or transaction execution is active.",
      payload: healthPayload(result, "Top-up may be required. Future Decred top-up watcher events can resolve this placeholder."),
    }));
  }

  if (result.liquidationReviewEligible) {
    events.push(createHeadlessLifecycleEvent({
      lookupCode: input.record.lookupCode,
      kind: "liquidation_review_confirmed",
      source: "oracle",
      observedAt: result.createdAt,
      createdAt: result.createdAt,
      externalReference: result.resultId,
      safetyAuditNote: "Liquidation review eligibility is not liquidation execution. No transaction creation, signing, broadcast, or funds movement occurred.",
      payload: healthPayload(result, "Liquidation review eligibility recorded for arbiter/manual review only."),
    }));
  }

  return events;
}

export function createLifecycleOracleHealthSummary(result: LiquidationHealthResult): LifecycleOracleHealthSummary {
  return {
    resultId: result.resultId,
    policyVersion: result.policy.policyVersion,
    status: result.status,
    ltvBps: roundBps(result.ltvBps),
    collateralizationBps: roundBps(result.collateralizationBps),
    collateralValueUsd: roundUsd(result.collateralValueUsd),
    debtValueUsd: roundUsd(result.debtValueUsd),
    selectedDcrUsdPrice: result.priceInputsUsed.dcrUsd,
    selectedBorrowAssetUsdPrice: result.priceInputsUsed.borrowAssetUsd,
    oracleSourceCount: result.oracleInput.sourceCount,
    oracleFreshnessStatus: result.oracleInput.freshnessStatus,
    oracleDeviationStatus: result.oracleInput.deviationStatus,
    oracleQuorumStatus: result.oracleInput.quorumStatus,
    oracleUsable: result.oracleUsable,
    blockerReason: result.blockerReason,
    borrowerSafeSummary: result.borrowerSafeSummary,
    operatorInternalSummary: result.operatorInternalSummary,
    nextBorrowerAction: result.nextBorrowerAction,
    nextOperatorArbiterAction: result.nextOperatorArbiterAction,
    shouldOpenArbiterReview: result.shouldOpenArbiterReview,
    liquidationReviewEligible: result.liquidationReviewEligible,
    automaticLiquidationBlocked: result.automaticLiquidationBlocked,
    auditNote: "Lifecycle summary stores privacy-safe policy output only. Borrower contact/support notes are excluded.",
    updatedAt: result.createdAt,
  };
}

export function createLiquidationHealthEvidenceSummary(input: {
  resultId: string;
  record: HeadlessLoanLifecycleRecord;
  status: HeadlessLiquidationHealthStatus;
  ltvBps: number;
  collateralizationBps: number;
  collateralValueUsd: number;
  debtValueUsd: number;
  oracleInput: OraclePolicyInput;
  watcherRisk: LiquidationWatcherRiskInput;
  repaymentStatus: RepaymentHealthStatus;
  borrowerSafeSummary: string;
  operatorInternalSummary: string;
  policy: LiquidationHealthPolicyConfig;
}): LiquidationHealthEvidenceSummary {
  return {
    healthResultId: input.resultId,
    lookupCode: input.record.lookupCode,
    policyVersion: input.policy.policyVersion,
    oracleObservationIds: input.oracleInput.selectedObservationIds,
    selectedDcrUsdPrice: input.oracleInput.selectedDcrUsdPrice,
    selectedBorrowAssetUsdPrice: input.oracleInput.selectedBorrowAssetUsdPrice,
    ltvBps: roundBps(input.ltvBps),
    collateralizationBps: roundBps(input.collateralizationBps),
    collateralValueUsd: roundUsd(input.collateralValueUsd),
    debtValueUsd: roundUsd(input.debtValueUsd),
    thresholds: {
      safeLtvBps: input.policy.safeLtvBps,
      warningLtvBps: input.policy.warningLtvBps,
      marginCallLtvBps: input.policy.marginCallLtvBps,
      liquidationEligibleLtvBps: input.policy.liquidationEligibleLtvBps,
    },
    watcherFreshnessSummary: `DCR watcher ${input.watcherRisk.decredWatcher}; borrow-asset watcher ${input.watcherRisk.borrowAssetWatcher}.`,
    repaymentSummary: `Repayment status: ${input.repaymentStatus}.`,
    borrowerSafeSummary: input.borrowerSafeSummary,
    operatorInternalSummary: input.operatorInternalSummary,
    safetyAuditNote: "Privacy-safe liquidation health evidence summary. It excludes borrower contact/support notes and does not authorize liquidation execution.",
  };
}

function healthPayload(result: LiquidationHealthResult, detail: string): HeadlessLifecycleEvent["payload"] {
  return {
    detail,
    status: result.lifecycleStatus,
    health: result.status,
    healthResultId: result.resultId,
    policyVersion: result.policy.policyVersion,
    oracleObservationIds: result.priceInputsUsed.observationIds,
    selectedDcrUsdPrice: result.priceInputsUsed.dcrUsd,
    selectedBorrowAssetUsdPrice: result.priceInputsUsed.borrowAssetUsd,
    oracleSourceCount: result.oracleInput.sourceCount,
    oracleFreshnessStatus: result.oracleInput.freshnessStatus,
    oracleDeviationStatus: result.oracleInput.deviationStatus,
    oracleQuorumStatus: result.oracleInput.quorumStatus,
    oracleUsable: result.oracleUsable,
    oracleBlockerReason: result.blockerReason,
    ltvBps: roundBps(result.ltvBps),
    collateralizationBps: roundBps(result.collateralizationBps),
    collateralValueUsd: roundUsd(result.collateralValueUsd),
    debtValueUsd: roundUsd(result.debtValueUsd),
    warningWindowStatus: result.borrowerWarningWindow.status,
    warningDeadline: result.borrowerWarningWindow.warningDeadline,
    topUpPlaceholderAmountDcr: result.borrowerWarningWindow.topUpPlaceholderAmountDcr,
    borrowerSafeSummary: result.borrowerSafeSummary,
    operatorInternalSummary: result.operatorInternalSummary,
    nextBorrowerAction: result.nextBorrowerAction,
    nextOperatorArbiterAction: result.nextOperatorArbiterAction,
    shouldOpenArbiterReview: result.shouldOpenArbiterReview,
    liquidationReviewEligible: result.liquidationReviewEligible,
    automaticLiquidationBlocked: result.automaticLiquidationBlocked,
    evidenceId: result.evidenceSummary.healthResultId,
  };
}

function observationsForPair(observations: OraclePriceObservation[], pair: OracleAssetPair): OraclePriceObservation[] {
  return observations.filter((observation) => observation.assetPair === pair && observation.quality !== "blocked" && observation.price > 0);
}

function resolveOracleBlocker(input: {
  missing: boolean;
  stale: boolean;
  deviated: boolean;
  quorumPassed: boolean;
  positivePrices: boolean;
  sourceCount: number;
  policy: LiquidationHealthPolicyConfig;
}): string | undefined {
  if (input.missing) return "Oracle data is missing for DCR/USD or the borrow asset/USD pair.";
  if (!input.positivePrices) return "Oracle prices must be positive.";
  if (input.stale) return "Oracle data is stale.";
  if (input.deviated) return "Oracle source deviation exceeds policy.";
  if (!input.quorumPassed) return `Oracle source count ${input.sourceCount} is below required quorum ${input.policy.minimumOracleSourceCount}.`;
  return undefined;
}

function resolveHealthStatus(input: {
  ltvBps: number;
  blockerReason?: string;
  repaymentStatus: RepaymentHealthStatus;
  arbiterReviewStatus: HeadlessLoanLifecycleRecord["arbiterReview"]["status"];
  policy: LiquidationHealthPolicyConfig;
}): HeadlessLiquidationHealthStatus {
  if (input.repaymentStatus === "repaid") return "resolved";
  if (input.blockerReason) return "blocked";
  if (input.arbiterReviewStatus === "requested") return "arbiter_window_open";
  if (input.ltvBps >= input.policy.liquidationEligibleLtvBps) return "liquidation_eligible";
  if (input.ltvBps >= input.policy.marginCallLtvBps) return "margin_call";
  if (input.ltvBps >= input.policy.warningLtvBps) return "warning";
  if (input.ltvBps >= input.policy.safeLtvBps) return "watch";
  return "healthy";
}

function createBorrowerWarningWindow(input: {
  status: HeadlessLiquidationHealthStatus;
  ltvBps: number;
  collateralDcr: number;
  debtValueUsd: number;
  collateralValueUsd: number;
  policy: LiquidationHealthPolicyConfig;
  now: string;
}): BorrowerWarningWindow {
  if (input.status === "healthy" || input.status === "watch" || input.status === "resolved") {
    return {
      status: input.status === "resolved" ? "resolved" : "not_required",
      topUpRequested: false,
      topUpPlaceholderAmountDcr: 0,
      borrowerSafeMessage: input.status === "resolved" ? "Review resolved." : "Healthy",
      updatedAt: input.now,
    };
  }

  if (input.status === "blocked") {
    return {
      status: "blocked",
      topUpRequested: false,
      topUpPlaceholderAmountDcr: 0,
      borrowerSafeMessage: "Review blocked until oracle data is fresh.",
      updatedAt: input.now,
    };
  }

  const topUpRequested = input.status === "margin_call" || input.status === "liquidation_eligible" || input.status === "arbiter_window_open";
  const targetCollateralUsd = input.debtValueUsd / (input.policy.safeLtvBps / 10_000);
  const topUpUsd = Math.max(targetCollateralUsd - input.collateralValueUsd, 0);
  const dcrUsd = input.collateralDcr > 0 ? input.collateralValueUsd / input.collateralDcr : 0;

  return {
    status: topUpRequested ? "top_up_requested" : "warning_open",
    warningOpenedAt: input.now,
    warningDeadline: addMinutes(input.now, topUpRequested ? input.policy.topUpWindowMinutes : input.policy.borrowerWarningWindowMinutes),
    topUpRequested,
    topUpPlaceholderAmountDcr: dcrUsd > 0 ? roundAsset(topUpUsd / dcrUsd) : 0,
    borrowerSafeMessage: topUpRequested ? "Top-up may be required." : "Collateral warning open.",
    updatedAt: input.now,
  };
}

function shouldOpenReview(status: HeadlessLiquidationHealthStatus, blockerReason: string | undefined, watcherRisk: LiquidationWatcherRiskInput): boolean {
  if (["margin_call", "liquidation_eligible", "arbiter_window_open", "blocked"].includes(status)) return true;
  if (blockerReason?.toLowerCase().includes("stale") || blockerReason?.toLowerCase().includes("evidence")) return true;
  return watcherRisk.decredWatcher !== "fresh" || watcherRisk.borrowAssetWatcher !== "fresh" || !watcherRisk.evidenceComplete;
}

function watcherBlocker(watcherRisk: LiquidationWatcherRiskInput): string | undefined {
  if (watcherRisk.decredWatcher === "stale" || watcherRisk.borrowAssetWatcher === "stale") return "Watcher data is stale.";
  if (watcherRisk.decredWatcher === "reorged" || watcherRisk.borrowAssetWatcher === "reorged") return "Watcher data was reorged.";
  if (watcherRisk.decredWatcher === "unfinalized" || watcherRisk.borrowAssetWatcher === "unfinalized") return "Watcher data is not final.";
  if (!watcherRisk.evidenceComplete) return "Evidence is incomplete.";
  return undefined;
}

function repaymentStatusFromRecord(record: HeadlessLoanLifecycleRecord): RepaymentHealthStatus {
  if (record.repaymentDetection.status === "detected") return "repaid";
  if (record.repaymentDetection.status === "partial") return "partial";
  return "none";
}

function collateralDcrFromRecord(record: HeadlessLoanLifecycleRecord): number {
  return Math.max(record.quote.collateralRequiredWithFeeDcr - record.quote.totalPlatformFeeDcr, 0);
}

function borrowerSummaryForStatus(status: HeadlessLiquidationHealthStatus, blockerReason?: string): string {
  switch (status) {
    case "healthy":
    case "watch":
      return "Healthy";
    case "warning":
      return "Collateral warning";
    case "margin_call":
      return "Top-up may be required";
    case "liquidation_eligible":
    case "arbiter_window_open":
    case "liquidation_review":
      return "Arbiter review open";
    case "blocked":
      return blockerReason?.toLowerCase().includes("oracle") ? "Review blocked until oracle data is fresh" : "Loan health is under review";
    case "resolved":
      return "Review resolved";
    case "auto_liquidation_pending":
      return "Liquidation execution is not active";
  }
}

function borrowerActionForStatus(status: HeadlessLiquidationHealthStatus): string {
  if (status === "healthy" || status === "watch") return "No collateral health action is required.";
  if (status === "warning") return "Loan health is under review. Monitor the collateral warning.";
  if (status === "margin_call") return "Top-up may be required. Watch for reviewed top-up instructions.";
  if (status === "resolved") return "Review resolved. Continue normal repayment tracking.";
  if (status === "blocked") return "Wait while operators refresh oracle/watcher evidence.";
  return "Arbiter review window is open. Liquidation execution is not active.";
}

function operatorActionForStatus(status: HeadlessLiquidationHealthStatus, blockerReason?: string): string {
  if (status === "healthy" || status === "watch") return "Continue monitoring fixture/manual oracle and watcher state.";
  if (status === "warning") return "Open borrower warning window and monitor top-up conditions.";
  if (status === "margin_call") return "Request top-up placeholder and prepare arbiter review evidence.";
  if (status === "blocked") return blockerReason ?? "Refresh blocked evidence before review.";
  if (status === "resolved") return "No liquidation-health review is active.";
  return "Open arbiter review case. Do not create, sign, broadcast, or execute liquidation transactions.";
}

function operatorSummary(input: {
  status: HeadlessLiquidationHealthStatus;
  ltvBps: number;
  blockerReason?: string;
  watcherRisk: LiquidationWatcherRiskInput;
  oracleInput: OraclePolicyInput;
}): string {
  const base = `Health ${input.status}; LTV ${roundBps(input.ltvBps)} bps; oracle usable ${input.oracleInput.usable}; DCR watcher ${input.watcherRisk.decredWatcher}; borrow watcher ${input.watcherRisk.borrowAssetWatcher}.`;
  return input.blockerReason ? `${base} Blocker: ${input.blockerReason}` : base;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[midpoint - 1] + sorted[midpoint]) / 2 : sorted[midpoint];
}

function calculateDeviationBps(values: number[]): number {
  if (values.length <= 1) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = median(sorted);
  return midpoint > 0 ? ((sorted[sorted.length - 1] - sorted[0]) / midpoint) * 10_000 : 0;
}

function observationAgeMs(observation: OraclePriceObservation, now: string): number {
  return Math.max(Date.parse(now) - Date.parse(observation.observedAt), 0);
}

function createHealthResultId(lookupCode: string, now: string): string {
  const compactLookup = lookupCode.replace(/[^a-zA-Z0-9]/g, "").slice(-12).toLowerCase();
  const compactTime = now.replace(/[^0-9]/g, "").slice(0, 14);
  return `health-${compactTime}-${compactLookup}`;
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60 * 1000).toISOString();
}

function roundBps(value: number): number {
  return Number(value.toFixed(2));
}

function roundUsd(value: number): number {
  return Number(value.toFixed(2));
}

function roundAsset(value: number): number {
  return Number(value.toFixed(8));
}
