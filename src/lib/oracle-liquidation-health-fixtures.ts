import { deriveAndStoreArbiterCases } from "./arbiter-case-api";
import type { ArbiterCaseStore } from "./arbiter-case-store";
import type { ArbiterReviewCase } from "./arbiter-review-cases";
import { headlessLifecycleStore, type HeadlessLifecycleStore } from "./headless-lifecycle-store";
import { submitHeadlessLifecycleEvent } from "./headless-lifecycle-event-api";
import type { HeadlessLifecycleEvent } from "./headless-lifecycle-events";
import type { HeadlessLoanLifecycleRecord } from "./headless-loan-lifecycle";
import { lifecycleEventStore, type HeadlessLifecycleEventStore } from "./lifecycle-event-store";
import {
  buildOraclePolicyInput,
  createLiquidationHealthLifecycleEvents,
  createOraclePriceObservation,
  DEFAULT_LIQUIDATION_HEALTH_POLICY,
  evaluateLiquidationHealth,
  type LiquidationHealthEvidenceSummary,
  type LiquidationHealthPolicyConfig,
  type LiquidationHealthResult,
  type LiquidationWatcherRiskInput,
  type OracleAssetPair,
  type OraclePolicyInput,
  type OraclePriceObservation,
} from "./oracle-liquidation-health";

export type LiquidationHealthFixtureScenarioName =
  | "healthy_loan"
  | "warning_state"
  | "margin_call_state"
  | "liquidation_eligible_state"
  | "stale_oracle"
  | "deviated_oracle"
  | "stale_watcher"
  | "borrower_warning_opened"
  | "top_up_requested"
  | "arbiter_review_case_opened"
  | "evidence_summary_prepared";

export interface LiquidationHealthFixtureScenario {
  scenario: LiquidationHealthFixtureScenarioName;
  observations: OraclePriceObservation[];
  oracleInput: OraclePolicyInput;
  healthResult: LiquidationHealthResult;
  lifecycleEvents: HeadlessLifecycleEvent[];
  evidenceSummary: LiquidationHealthEvidenceSummary;
  safetyNote: string;
}

export interface SubmittedLiquidationHealthFixtureScenario extends LiquidationHealthFixtureScenario {
  finalRecord: HeadlessLoanLifecycleRecord;
  submittedEvents: HeadlessLifecycleEvent[];
  arbiterCases: ArbiterReviewCase[];
  arbiterLifecycleEvents: HeadlessLifecycleEvent[];
}

export function createFixtureLiquidationHealthScenario(input: {
  scenario: LiquidationHealthFixtureScenarioName;
  record: HeadlessLoanLifecycleRecord;
  now?: string;
  policy?: LiquidationHealthPolicyConfig;
}): LiquidationHealthFixtureScenario {
  const now = input.now ?? "2026-06-24T12:00:00.000Z";
  const policy = input.policy ?? DEFAULT_LIQUIDATION_HEALTH_POLICY;
  const observations = createScenarioObservations({ scenario: input.scenario, record: input.record, now, policy });
  const oracleInput = buildOraclePolicyInput({ borrowAsset: input.record.borrowAsset, observations, now, policy });
  const healthResult = evaluateScenarioHealth({ scenario: input.scenario, record: input.record, oracleInput, now, policy });
  const lifecycleEvents = createLiquidationHealthLifecycleEvents({ record: input.record, result: healthResult });

  return {
    scenario: input.scenario,
    observations,
    oracleInput,
    healthResult,
    lifecycleEvents,
    evidenceSummary: healthResult.evidenceSummary,
    safetyNote: "Fixture liquidation-health scenario is deterministic and review-only. It does not call live oracles, sign, broadcast, liquidate, or move funds.",
  };
}

export async function submitFixtureLiquidationHealthScenario(input: {
  scenario: LiquidationHealthFixtureScenarioName;
  record: HeadlessLoanLifecycleRecord;
  now?: string;
  policy?: LiquidationHealthPolicyConfig;
  stores?: {
    lifecycleStore?: HeadlessLifecycleStore;
    eventStore?: HeadlessLifecycleEventStore;
    arbiterStore?: ArbiterCaseStore;
  };
}): Promise<SubmittedLiquidationHealthFixtureScenario> {
  const lifecycleStore = input.stores?.lifecycleStore ?? headlessLifecycleStore;
  const eventStore = input.stores?.eventStore ?? lifecycleEventStore;
  await lifecycleStore.save(input.record);

  const scenario = createFixtureLiquidationHealthScenario(input);
  let finalRecord = input.record;
  const submittedEvents: HeadlessLifecycleEvent[] = [];

  for (const event of scenario.lifecycleEvents) {
    const submitted = await submitHeadlessLifecycleEvent(event, { lifecycleStore, eventStore });
    if (!submitted.ok || !submitted.data) throw new Error(submitted.error ?? `Could not submit ${event.kind}.`);
    finalRecord = submitted.data.record;
    submittedEvents.push(submitted.data.event);
  }

  const arbiterResult = await deriveAndStoreArbiterCases({
    record: finalRecord,
    recentEvents: submittedEvents,
    now: input.now ?? "2026-06-24T12:00:00.000Z",
    stores: { lifecycleStore, eventStore, arbiterStore: input.stores?.arbiterStore },
  });

  return {
    ...scenario,
    finalRecord,
    submittedEvents,
    arbiterCases: arbiterResult.data?.cases ?? [],
    arbiterLifecycleEvents: arbiterResult.data?.lifecycleEvents ?? [],
  };
}

function evaluateScenarioHealth(input: {
  scenario: LiquidationHealthFixtureScenarioName;
  record: HeadlessLoanLifecycleRecord;
  oracleInput: OraclePolicyInput;
  now: string;
  policy: LiquidationHealthPolicyConfig;
}): LiquidationHealthResult {
  const watcherRisk: Partial<LiquidationWatcherRiskInput> = input.scenario === "stale_watcher"
    ? { decredWatcher: "stale", auditNote: "Fixture stale watcher scenario. Review is blocked until watcher evidence is fresh." }
    : { auditNote: "Fixture/manual watcher freshness input. No chain calls are made." };

  return evaluateLiquidationHealth({
    record: input.record,
    oracleInput: input.oracleInput,
    now: input.now,
    policy: input.policy,
    watcherRisk,
  });
}

function createScenarioObservations(input: {
  scenario: LiquidationHealthFixtureScenarioName;
  record: HeadlessLoanLifecycleRecord;
  now: string;
  policy: LiquidationHealthPolicyConfig;
}): OraclePriceObservation[] {
  const dcrPrices = dcrPricesForScenario(input.scenario);
  const observedAt = input.scenario === "stale_oracle"
    ? new Date(Date.parse(input.now) - input.policy.maxOracleAgeMs - 60_000).toISOString()
    : input.now;
  const borrowAssetUsd = input.record.borrowAsset === "BTC" ? 64_000 : 1;
  const borrowPair = `${input.record.borrowAsset}/USD` as OracleAssetPair;

  return [
    createOraclePriceObservation({ observationId: `${input.scenario}-dcr-a`, observedAt, providerId: "fixture-dcr-a", providerName: "Fixture DCR provider A", assetPair: "DCR/USD", price: dcrPrices[0], confidenceScore: 0.91 }),
    createOraclePriceObservation({ observationId: `${input.scenario}-dcr-b`, observedAt, providerId: "fixture-dcr-b", providerName: "Fixture DCR provider B", assetPair: "DCR/USD", price: dcrPrices[1], confidenceScore: 0.9 }),
    createOraclePriceObservation({ observationId: `${input.scenario}-borrow-a`, observedAt, providerId: "fixture-borrow-a", providerName: "Fixture borrow asset provider A", assetPair: borrowPair, price: borrowAssetUsd, confidenceScore: 0.92 }),
    createOraclePriceObservation({ observationId: `${input.scenario}-borrow-b`, observedAt, providerId: "fixture-borrow-b", providerName: "Fixture borrow asset provider B", assetPair: borrowPair, price: borrowAssetUsd, confidenceScore: 0.92 }),
  ];
}

function dcrPricesForScenario(scenario: LiquidationHealthFixtureScenarioName): [number, number] {
  switch (scenario) {
    case "warning_state":
    case "borrower_warning_opened":
      return [14, 14];
    case "margin_call_state":
    case "top_up_requested":
      return [13, 13];
    case "liquidation_eligible_state":
    case "arbiter_review_case_opened":
      return [11, 11];
    case "deviated_oracle":
      return [20, 8];
    case "healthy_loan":
    case "stale_oracle":
    case "stale_watcher":
    case "evidence_summary_prepared":
      return [30, 30];
  }
}
