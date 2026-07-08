import { z } from "zod";
import { deriveAndStoreArbiterCases } from "./arbiter-case-api";
import type { ArbiterCaseStore } from "./arbiter-case-store";
import { arbiterCaseStore } from "./arbiter-case-store";
import type { ArbiterReviewCase } from "./arbiter-review-cases";
import { formatSchemaError } from "./api-schemas";
import { createFixtureBorrowAssetLifecycleEvent } from "./borrow-asset-watcher-fixtures";
import type { BorrowAssetExpectedSettlementTerms, BorrowAssetRailNetwork } from "./borrow-asset-watcher-events";
import { createFixtureWatcherLifecycleEvent } from "./decred-watcher-fixtures";
import type { DecredExpectedOutputTerms } from "./decred-watcher-events";
import { createAndSaveHeadlessLifecycle } from "./headless-lifecycle-api";
import { submitHeadlessLifecycleEvent } from "./headless-lifecycle-event-api";
import { createHeadlessLifecycleEvent, type HeadlessLifecycleEvent } from "./headless-lifecycle-events";
import type { HeadlessLifecycleStore } from "./headless-lifecycle-store";
import { headlessLifecycleStore } from "./headless-lifecycle-store";
import type { HeadlessLoanLifecycleRecord } from "./headless-loan-lifecycle";
import type { HeadlessLifecycleEventStore } from "./lifecycle-event-store";
import { lifecycleEventStore } from "./lifecycle-event-store";
import { submitFixtureLiquidationHealthScenario } from "./oracle-liquidation-health-fixtures";
import { refreshSimnetProofSession } from "./simnet-proof-readiness-api";
import type { SimnetProofSession } from "./simnet-proof-readiness";
import type { SimnetProofSessionStore } from "./simnet-proof-readiness-store";
import { simnetProofSessionStore } from "./simnet-proof-readiness-store";

export type GuidedOperatorDemoStepId =
  | "seed_or_select_record"
  | "decred_collateral_fixture"
  | "dcr_platform_fee_fixture"
  | "borrow_asset_disbursement_fixture"
  | "oracle_health_fixture"
  | "evidence_timestamp_fixture"
  | "arbiter_review_visibility"
  | "simnet_proof_readiness";

export type GuidedOperatorDemoStepStatus = "complete" | "available" | "blocked";
export type GuidedOperatorDemoAction = "seed_record" | "run_next" | "run_all" | "refresh";

export interface GuidedOperatorDemoStep {
  id: GuidedOperatorDemoStepId;
  label: string;
  status: GuidedOperatorDemoStepStatus;
  detail: string;
  emittedEventIds: string[];
  linkedArbiterCaseIds: string[];
  proofSessionId?: string;
}

export interface GuidedOperatorDemoScenario {
  scenarioId: string;
  scenarioName: string;
  lookupCode: string;
  phase: string;
  steps: GuidedOperatorDemoStep[];
  completedStepCount: number;
  blockedStepCount: number;
  nextStepId?: GuidedOperatorDemoStepId;
  nextSafeOperatorAction: string;
  eventIdsEmitted: string[];
  arbiterCaseIds: string[];
  simnetProofSessionId?: string;
  borrowerSafeStatus: "Loan setup in progress" | "Collateral review in progress" | "Repayment review in progress" | "Loan health review in progress" | "Proof readiness review in progress";
  safetyNotes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GuidedOperatorDemoApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export interface GuidedOperatorDemoRunResult {
  scenario: GuidedOperatorDemoScenario;
  record: HeadlessLoanLifecycleRecord;
  submittedEvents: HeadlessLifecycleEvent[];
  arbiterCases: ArbiterReviewCase[];
  proofSession?: SimnetProofSession;
  safetyNote: string;
}

const SAFETY_NOTES = [
  "Guided operator demo scenario is fixture-only and review-only.",
  "No live Decred, Bitcoin, EVM, or oracle RPC is called.",
  "No wallet integration, private keys, seed phrases, wallet unlock, app-side signing, broadcast, mainnet, collateral release execution, liquidation execution, real transactions, or fund movement is enabled.",
  "Broadcast blocked. No signing, no broadcast, no real funds.",
];

const DEFAULT_NOW = "2026-07-08T14:00:00.000Z";
const seedSchema = z.object({
  now: z.string().datetime().optional(),
});
const actionSchema = z.object({
  lookupCode: z.string().trim().min(1).max(120).optional(),
  action: z.enum(["seed_record", "run_next", "run_all", "refresh"]).default("refresh"),
  now: z.string().datetime().optional(),
});

export function createGuidedOperatorDemoPlan(record: HeadlessLoanLifecycleRecord): GuidedOperatorDemoScenario {
  return deriveGuidedOperatorDemoStatus(record, [], [], []);
}

export function deriveGuidedOperatorDemoStatus(
  record: HeadlessLoanLifecycleRecord,
  events: HeadlessLifecycleEvent[] = [],
  cases: ArbiterReviewCase[] = [],
  proofSessions: SimnetProofSession[] = [],
): GuidedOperatorDemoScenario {
  const proofSession = proofSessions.find((session) => session.lookupCode === record.lookupCode);
  const steps = buildSteps(record, events, cases, proofSession);
  const availableStep = steps.find((step) => step.status === "available");
  const completedStepCount = steps.filter((step) => step.status === "complete").length;
  const blockedStepCount = steps.filter((step) => step.status === "blocked").length;
  const eventIdsEmitted = unique(steps.flatMap((step) => step.emittedEventIds));
  const arbiterCaseIds = unique([...cases.map((reviewCase) => reviewCase.caseId), ...steps.flatMap((step) => step.linkedArbiterCaseIds)]);

  return {
    scenarioId: `guided-demo-${compactLookup(record.lookupCode)}`,
    scenarioName: "Guided operator demo scenario",
    lookupCode: record.lookupCode,
    phase: resolvePhase(steps, proofSession),
    steps,
    completedStepCount,
    blockedStepCount,
    nextStepId: availableStep?.id,
    nextSafeOperatorAction: availableStep ? actionForStep(availableStep.id) : "Review the consolidated demo state. Broadcast remains blocked.",
    eventIdsEmitted,
    arbiterCaseIds,
    simnetProofSessionId: proofSession?.proofSessionId,
    borrowerSafeStatus: borrowerSafeStatus(record, proofSession),
    safetyNotes: SAFETY_NOTES,
    createdAt: record.timestamps.createdAt,
    updatedAt: proofSession?.updatedAt ?? newestTimestamp(record, events, cases),
  };
}

export async function seedGuidedOperatorDemoRecord(
  input: unknown,
  stores: { lifecycleStore?: HeadlessLifecycleStore } = {},
): Promise<GuidedOperatorDemoApiResult<{ record: HeadlessLoanLifecycleRecord; scenario: GuidedOperatorDemoScenario }>> {
  const parsed = seedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, error: formatSchemaError(parsed.error) };

  const lifecycleStore = stores.lifecycleStore ?? headlessLifecycleStore;
  const created = await createAndSaveHeadlessLifecycle({
    collateralDcr: 120,
    borrowAmount: 1000,
    borrowAsset: "USDC",
    borrowerAcceptedPartialFunding: true,
    repaymentAmount: 0,
    durationDays: 30,
    requestedAmountUsd: 1000,
    borrowerContact: { preference: "none", consentForUpdates: false },
  }, lifecycleStore);
  if (!created.ok || !created.data) return { ok: false, status: created.status, error: created.error ?? "Could not seed guided demo record." };

  return {
    ok: true,
    status: 201,
    data: {
      record: created.data.record,
      scenario: createGuidedOperatorDemoPlan(created.data.record),
    },
  };
}

export async function readGuidedOperatorDemoScenario(
  input: unknown,
  stores: GuidedOperatorDemoStores = {},
): Promise<GuidedOperatorDemoApiResult<{ record: HeadlessLoanLifecycleRecord; scenario: GuidedOperatorDemoScenario }>> {
  const parsed = z.object({ lookupCode: z.string().trim().min(1).max(120) }).safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, error: formatSchemaError(parsed.error) };

  const loaded = await loadScenarioInputs(parsed.data.lookupCode, stores);
  if (!loaded.record) return { ok: false, status: 404, error: "Lifecycle record not found." };
  return { ok: true, status: 200, data: { record: loaded.record, scenario: deriveGuidedOperatorDemoStatus(loaded.record, loaded.events, loaded.cases, loaded.proofSessions) } };
}

export interface GuidedOperatorDemoStores {
  lifecycleStore?: HeadlessLifecycleStore;
  eventStore?: HeadlessLifecycleEventStore;
  arbiterStore?: ArbiterCaseStore;
  sessionStore?: SimnetProofSessionStore;
}

export async function runGuidedOperatorDemoAction(
  input: unknown,
  stores: GuidedOperatorDemoStores = {},
): Promise<GuidedOperatorDemoApiResult<GuidedOperatorDemoRunResult>> {
  const parsed = actionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, error: formatSchemaError(parsed.error) };
  if (parsed.data.action === "seed_record") {
    const seeded = await seedGuidedOperatorDemoRecord({ now: parsed.data.now }, { lifecycleStore: stores.lifecycleStore });
    if (!seeded.ok || !seeded.data) return { ok: false, status: seeded.status, error: seeded.error };
    return {
      ok: true,
      status: 201,
      data: {
        scenario: seeded.data.scenario,
        record: seeded.data.record,
        submittedEvents: [],
        arbiterCases: [],
        safetyNote: SAFETY_NOTES.join(" "),
      },
    };
  }
  if (!parsed.data.lookupCode) return { ok: false, status: 400, error: "lookupCode is required unless action is seed_record." };

  const loaded = await loadScenarioInputs(parsed.data.lookupCode, stores);
  if (!loaded.record) return { ok: false, status: 404, error: "Lifecycle record not found." };

  if (parsed.data.action === "refresh") {
    return {
      ok: true,
      status: 200,
      data: {
        scenario: deriveGuidedOperatorDemoStatus(loaded.record, loaded.events, loaded.cases, loaded.proofSessions),
        record: loaded.record,
        submittedEvents: [],
        arbiterCases: loaded.cases,
        proofSession: loaded.proofSessions[0],
        safetyNote: SAFETY_NOTES.join(" "),
      },
    };
  }

  const submittedEvents: HeadlessLifecycleEvent[] = [];
  let currentRecord = loaded.record;
  let proofSession: SimnetProofSession | undefined = loaded.proofSessions[0];
  const maxIterations = parsed.data.action === "run_all" ? 8 : 1;

  for (let index = 0; index < maxIterations; index += 1) {
    const latest = await loadScenarioInputs(currentRecord.lookupCode, stores);
    if (!latest.record) break;
    currentRecord = latest.record;
    const scenario = deriveGuidedOperatorDemoStatus(currentRecord, latest.events, latest.cases, latest.proofSessions);
    if (!scenario.nextStepId) {
      proofSession = latest.proofSessions[0];
      break;
    }
    const applied = await runStep(scenario.nextStepId, currentRecord, parsed.data.now, stores);
    currentRecord = applied.record;
    submittedEvents.push(...applied.submittedEvents);
    if (applied.proofSession) proofSession = applied.proofSession;
  }

  const finalInputs = await loadScenarioInputs(currentRecord.lookupCode, stores);
  const finalRecord = finalInputs.record ?? currentRecord;
  return {
    ok: true,
    status: submittedEvents.length || proofSession ? 201 : 200,
    data: {
      scenario: deriveGuidedOperatorDemoStatus(finalRecord, finalInputs.events, finalInputs.cases, finalInputs.proofSessions),
      record: finalRecord,
      submittedEvents,
      arbiterCases: finalInputs.cases,
      proofSession: finalInputs.proofSessions[0] ?? proofSession,
      safetyNote: SAFETY_NOTES.join(" "),
    },
  };
}

async function runStep(
  stepId: GuidedOperatorDemoStepId,
  record: HeadlessLoanLifecycleRecord,
  now: string | undefined,
  stores: GuidedOperatorDemoStores,
): Promise<{ record: HeadlessLoanLifecycleRecord; submittedEvents: HeadlessLifecycleEvent[]; proofSession?: SimnetProofSession }> {
  const lifecycleStore = stores.lifecycleStore ?? headlessLifecycleStore;
  const eventStore = stores.eventStore ?? lifecycleEventStore;
  const arbiterStore = stores.arbiterStore ?? arbiterCaseStore;
  const observedAt = stepTimestamp(stepId, now);
  const submittedEvents: HeadlessLifecycleEvent[] = [];

  if (stepId === "decred_collateral_fixture") {
    const submitted = await submitFixtureLifecycleEvent(createFixtureWatcherLifecycleEvent({
      scenario: "valid_collateral_lock_observed",
      lookupCode: record.lookupCode,
      expectedCollateral: expectedCollateralTerms(record),
      expectedPlatformFee: expectedPlatformFeeTerms(record),
      observedAt,
    }), stores);
    return { record: submitted.record, submittedEvents: [submitted.event] };
  }

  if (stepId === "dcr_platform_fee_fixture") {
    const submitted = await submitFixtureLifecycleEvent(createFixtureWatcherLifecycleEvent({
      scenario: "valid_platform_fee_output_observed",
      lookupCode: record.lookupCode,
      expectedCollateral: expectedCollateralTerms(record),
      expectedPlatformFee: expectedPlatformFeeTerms(record),
      observedAt,
    }), stores);
    return { record: submitted.record, submittedEvents: [submitted.event] };
  }

  if (stepId === "borrow_asset_disbursement_fixture") {
    const submitted = await submitFixtureLifecycleEvent(createFixtureBorrowAssetLifecycleEvent({
      scenario: disbursementScenario(record),
      lookupCode: record.lookupCode,
      lifecycle: record,
      expectedDisbursement: expectedDisbursementTerms(record),
      expectedRepayment: expectedRepaymentTerms(record),
      observedAt,
    }), stores);
    return { record: submitted.record, submittedEvents: [submitted.event] };
  }

  if (stepId === "oracle_health_fixture") {
    const scenario = await submitFixtureLiquidationHealthScenario({
      scenario: "arbiter_review_case_opened",
      record,
      now: observedAt,
      stores: { lifecycleStore, eventStore, arbiterStore },
    });
    return { record: scenario.finalRecord, submittedEvents: [...scenario.submittedEvents, ...scenario.arbiterLifecycleEvents] };
  }

  if (stepId === "evidence_timestamp_fixture") {
    const prepared = await submitFixtureLifecycleEvent(createHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "evidence_bundle_prepared",
      source: "operator",
      observedAt,
      createdAt: observedAt,
      externalReference: `guided-demo-evidence-${compactLookup(record.lookupCode)}`,
      safetyAuditNote: "Guided demo evidence fixture is review-only. Full evidence remains off-chain. No signing, broadcast, or funds movement occurred.",
      payload: {
        detail: "Guided demo evidence bundle prepared for operator review.",
        evidenceId: `guided-demo-evidence-${compactLookup(record.lookupCode)}`,
      },
    }), stores);
    const verified = await submitFixtureLifecycleEvent(createHeadlessLifecycleEvent({
      lookupCode: record.lookupCode,
      kind: "evidence_timestamp_verified",
      source: "operator",
      observedAt: addMinutes(observedAt, 1),
      createdAt: addMinutes(observedAt, 1),
      externalReference: `guided-demo-evidence-timestamp-${compactLookup(record.lookupCode)}`,
      safetyAuditNote: "Guided demo evidence timestamp is a fixture placeholder only. It does not prove oracle correctness or enable release/liquidation.",
      payload: {
        detail: "Guided demo evidence timestamp verified as placeholder metadata.",
        evidenceId: `guided-demo-evidence-${compactLookup(record.lookupCode)}`,
        evidenceHash: `guided-demo-hash-${compactLookup(record.lookupCode)}`,
        digestAlgorithm: "sha256_placeholder",
        timestampProvider: "manual",
        verificationStatus: "verified",
        publicSummaryId: `guided-demo-summary-${compactLookup(record.lookupCode)}`,
        timestampAuditNote: "Manual fixture timestamp metadata only. Full evidence remains off-chain and private.",
      },
    }), { ...stores, lifecycleStore, eventStore, arbiterStore });
    return { record: verified.record, submittedEvents: [prepared.event, verified.event] };
  }

  if (stepId === "arbiter_review_visibility") {
    const recentEvents = await eventStore.listByLookupCode(record.lookupCode, 50);
    await deriveAndStoreArbiterCases({
      record,
      recentEvents,
      manualReviewReason: "Guided demo review checkpoint for operator visibility. Review-only; no execution.",
      now: observedAt,
      stores: { lifecycleStore, eventStore, arbiterStore },
    });
    const refreshed = await loadScenarioInputs(record.lookupCode, stores);
    return { record: refreshed.record ?? record, submittedEvents: [] };
  }

  if (stepId === "simnet_proof_readiness") {
    const refreshed = await refreshSimnetProofSession({ lookupCode: record.lookupCode, now: observedAt }, { lifecycleStore, eventStore, arbiterStore, sessionStore: stores.sessionStore });
    if (!refreshed.ok || !refreshed.data) throw new Error(refreshed.error ?? "Could not refresh simnet proof readiness.");
    return { record, submittedEvents, proofSession: refreshed.data.session };
  }

  return { record, submittedEvents };
}

async function submitFixtureLifecycleEvent(
  event: HeadlessLifecycleEvent,
  stores: GuidedOperatorDemoStores,
): Promise<{ event: HeadlessLifecycleEvent; record: HeadlessLoanLifecycleRecord }> {
  const submitted = await submitHeadlessLifecycleEvent(event, {
    lifecycleStore: stores.lifecycleStore,
    eventStore: stores.eventStore,
    arbiterStore: stores.arbiterStore,
  });
  if (!submitted.ok || !submitted.data) throw new Error(submitted.error ?? `Could not submit ${event.kind}.`);
  return { event: submitted.data.event, record: submitted.data.record };
}

async function loadScenarioInputs(lookupCode: string, stores: GuidedOperatorDemoStores): Promise<{
  record: HeadlessLoanLifecycleRecord | null;
  events: HeadlessLifecycleEvent[];
  cases: ArbiterReviewCase[];
  proofSessions: SimnetProofSession[];
}> {
  const lifecycleStore = stores.lifecycleStore ?? headlessLifecycleStore;
  const eventStore = stores.eventStore ?? lifecycleEventStore;
  const arbiterStore = stores.arbiterStore ?? arbiterCaseStore;
  const sessionStore = stores.sessionStore ?? simnetProofSessionStore;
  const record = await lifecycleStore.findByLookupCode(lookupCode);
  const [events, cases, proofSessions] = await Promise.all([
    eventStore.listByLookupCode(lookupCode, 100),
    arbiterStore.listByLookupCode(lookupCode, 100),
    sessionStore.listByLookupCode(lookupCode, 10),
  ]);
  return { record, events, cases, proofSessions };
}

function buildSteps(
  record: HeadlessLoanLifecycleRecord,
  events: HeadlessLifecycleEvent[],
  cases: ArbiterReviewCase[],
  proofSession?: SimnetProofSession,
): GuidedOperatorDemoStep[] {
  const hasCollateral = record.collateralLock.status === "locked" || hasEventKind(events, "collateral_lock_observed");
  const hasFee = ["detected", "routed"].includes(record.dcrPlatformFeeOutput.status) || hasEventKind(events, "dcr_platform_fee_output_observed");
  const hasDisbursement = record.supplierDisbursement.status === "disbursed" || hasEventKind(events, "supplier_disbursement_observed");
  const hasOracle = hasEventKind(events, "liquidation_health_updated") || record.oracleHealth.resultId !== "health-not-evaluated";
  const hasEvidence = record.evidenceBundle.status !== "placeholder" || record.evidenceBundle.timestamp.status === "verified" || hasEventKind(events, "evidence_timestamp_verified");
  const hasReview = cases.length > 0 || record.arbiterReview.status === "requested" || record.arbiterReview.status === "resolved";
  const hasProof = Boolean(proofSession);

  return [
    step("seed_or_select_record", "Seed or select lifecycle record", "complete", "Lifecycle record is available.", [], []),
    step("decred_collateral_fixture", "Apply Decred collateral fixture", hasCollateral ? "complete" : "available", hasCollateral ? "Collateral fixture observed." : "Submit fixture collateral observation through lifecycle event API.", eventIds(events, "collateral_lock_observed"), []),
    step("dcr_platform_fee_fixture", "Apply DCR platform-fee fixture", hasFee ? "complete" : hasCollateral ? "available" : "blocked", hasFee ? "Platform-fee fixture observed." : "Submit fixture platform fee output after collateral observation.", eventIds(events, "dcr_platform_fee_output_observed"), []),
    step("borrow_asset_disbursement_fixture", "Apply borrow-asset disbursement fixture", hasDisbursement ? "complete" : hasFee ? "available" : "blocked", hasDisbursement ? "Supplier disbursement fixture observed." : "Submit fixture supplier disbursement through lifecycle event API.", eventIds(events, "supplier_disbursement_observed"), []),
    step("oracle_health_fixture", "Apply oracle/liquidation-health fixture", hasOracle ? "complete" : hasDisbursement ? "available" : "blocked", hasOracle ? "Oracle/liquidation-health fixture applied." : "Run existing oracle/liquidation-health fixture helper.", eventIds(events, "liquidation_health_updated"), []),
    step("evidence_timestamp_fixture", "Apply evidence/timestamp placeholder", hasEvidence ? "complete" : hasOracle ? "available" : "blocked", hasEvidence ? "Evidence/timestamp placeholder prepared." : "Submit placeholder evidence and timestamp events through lifecycle event API.", eventIds(events, "evidence_bundle_prepared", "evidence_timestamp_verified"), []),
    step("arbiter_review_visibility", "Show arbiter review visibility", hasReview ? "complete" : hasEvidence ? "available" : "blocked", hasReview ? "Arbiter review case is visible." : "Open/link review-only arbiter case if needed.", eventIds(events, "arbiter_review_requested"), cases.map((reviewCase) => reviewCase.caseId)),
    step("simnet_proof_readiness", "Seed/refresh simnet proof readiness", hasProof ? "complete" : hasEvidence && hasReview ? "available" : "blocked", hasProof ? "Simnet proof readiness session exists." : "Refresh proof readiness from lifecycle, event, and review state.", [], [], proofSession?.proofSessionId),
  ].map((item, index, list) => {
    if (item.status !== "available") return item;
    const priorIncomplete = list.slice(0, index).some((prior) => prior.status !== "complete");
    return priorIncomplete ? { ...item, status: "blocked" as const } : item;
  });
}

function step(
  id: GuidedOperatorDemoStepId,
  label: string,
  status: GuidedOperatorDemoStepStatus,
  detail: string,
  emittedEventIds: string[],
  linkedArbiterCaseIds: string[],
  proofSessionId?: string,
): GuidedOperatorDemoStep {
  return { id, label, status, detail, emittedEventIds, linkedArbiterCaseIds, proofSessionId };
}

function expectedCollateralTerms(record: HeadlessLoanLifecycleRecord): DecredExpectedOutputTerms {
  return {
    lookupCode: record.lookupCode,
    expectedAmountDcr: record.quote.collateralRequiredWithFeeDcr,
    expectedAddressOrScript: `simnet-escrow-${compactLookup(record.lookupCode)}`,
    minConfirmations: 2,
    network: "simnet",
  };
}

function expectedPlatformFeeTerms(record: HeadlessLoanLifecycleRecord): DecredExpectedOutputTerms {
  return {
    lookupCode: record.lookupCode,
    expectedAmountDcr: record.quote.platformFeeDcr,
    expectedAddressOrScript: "simnet-platform-fee-treasury",
    minConfirmations: 2,
    network: "simnet",
  };
}

function expectedDisbursementTerms(record: HeadlessLoanLifecycleRecord): BorrowAssetExpectedSettlementTerms {
  const fill = record.acceptedSupplierFills[0];
  const position = record.supplierPositions[0];
  return {
    lookupCode: record.lookupCode,
    supplierFillId: fill?.id ?? "guided-demo-fill",
    supplierPositionId: position?.id ?? "guided-demo-position",
    asset: record.borrowAsset,
    railNetwork: railForAsset(record.borrowAsset),
    expectedAmount: record.quote.supplierFilledAmount || record.requestedAmount,
    expectedFromAddress: "guided-demo-supplier",
    expectedToAddress: `guided-demo-borrower-${compactLookup(record.lookupCode)}`,
    expectedTokenContract: record.borrowAsset === "BTC" ? undefined : `fixture-${record.borrowAsset.toLowerCase()}-token`,
    minConfirmations: record.borrowAsset === "BTC" ? 2 : 0,
    minFinalityDepth: record.borrowAsset === "BTC" ? undefined : 12,
  };
}

function expectedRepaymentTerms(record: HeadlessLoanLifecycleRecord): BorrowAssetExpectedSettlementTerms {
  return {
    lookupCode: record.lookupCode,
    asset: record.borrowAsset,
    railNetwork: railForAsset(record.borrowAsset),
    expectedAmount: Math.max(record.repaymentAllocationPreview.totalDue, record.requestedAmount),
    expectedFromAddress: `guided-demo-borrower-${compactLookup(record.lookupCode)}`,
    expectedToAddress: "guided-demo-repayment-vault",
    expectedTokenContract: record.borrowAsset === "BTC" ? undefined : `fixture-${record.borrowAsset.toLowerCase()}-token`,
    minConfirmations: record.borrowAsset === "BTC" ? 2 : 0,
    minFinalityDepth: record.borrowAsset === "BTC" ? undefined : 12,
  };
}

function disbursementScenario(record: HeadlessLoanLifecycleRecord): "valid_btc_supplier_disbursement" | "valid_usdc_supplier_disbursement" | "valid_usdt_supplier_disbursement" {
  if (record.borrowAsset === "BTC") return "valid_btc_supplier_disbursement";
  if (record.borrowAsset === "USDT") return "valid_usdt_supplier_disbursement";
  return "valid_usdc_supplier_disbursement";
}

function railForAsset(asset: HeadlessLoanLifecycleRecord["borrowAsset"]): BorrowAssetRailNetwork {
  return asset === "BTC" ? "bitcoin_simnet" : "evm_local";
}

function eventIds(events: HeadlessLifecycleEvent[], ...kinds: HeadlessLifecycleEvent["kind"][]): string[] {
  return events.filter((event) => kinds.includes(event.kind)).map((event) => event.id);
}

function hasEventKind(events: HeadlessLifecycleEvent[], kind: HeadlessLifecycleEvent["kind"]): boolean {
  return events.some((event) => event.kind === kind);
}

function borrowerSafeStatus(record: HeadlessLoanLifecycleRecord, proofSession?: SimnetProofSession): GuidedOperatorDemoScenario["borrowerSafeStatus"] {
  if (proofSession) return "Proof readiness review in progress";
  if (record.arbiterReview.status === "requested" || record.liquidationHealth.status !== "healthy") return "Loan health review in progress";
  if (record.repaymentDetection.status === "partial" || record.repaymentDetection.status === "detected") return "Repayment review in progress";
  if (record.collateralLock.status === "locked" || record.collateralLock.status === "failed") return "Collateral review in progress";
  return "Loan setup in progress";
}

function resolvePhase(steps: GuidedOperatorDemoStep[], proofSession?: SimnetProofSession): string {
  if (proofSession) return "proof readiness review";
  const next = steps.find((stepItem) => stepItem.status === "available");
  if (!next) return "review-only scenario complete";
  return next.label.toLowerCase();
}

function actionForStep(stepId: GuidedOperatorDemoStepId): string {
  switch (stepId) {
    case "seed_or_select_record":
      return "Seed or select a lifecycle record.";
    case "decred_collateral_fixture":
      return "Run the Decred collateral fixture event.";
    case "dcr_platform_fee_fixture":
      return "Run the DCR platform-fee fixture event.";
    case "borrow_asset_disbursement_fixture":
      return "Run the borrow-asset supplier disbursement fixture event.";
    case "oracle_health_fixture":
      return "Run the oracle/liquidation-health fixture.";
    case "evidence_timestamp_fixture":
      return "Run the evidence/timestamp placeholder fixture.";
    case "arbiter_review_visibility":
      return "Open or show the review-only arbiter case.";
    case "simnet_proof_readiness":
      return "Seed or refresh simnet proof readiness.";
  }
}

function newestTimestamp(record: HeadlessLoanLifecycleRecord, events: HeadlessLifecycleEvent[], cases: ArbiterReviewCase[]): string {
  return [record.timestamps.lastUpdatedAt, ...events.map((event) => event.createdAt), ...cases.map((reviewCase) => reviewCase.updatedAt)].sort().at(-1) ?? record.timestamps.lastUpdatedAt;
}

function stepTimestamp(stepId: GuidedOperatorDemoStepId, now: string | undefined): string {
  const base = now ?? DEFAULT_NOW;
  const offset = [
    "seed_or_select_record",
    "decred_collateral_fixture",
    "dcr_platform_fee_fixture",
    "borrow_asset_disbursement_fixture",
    "oracle_health_fixture",
    "evidence_timestamp_fixture",
    "arbiter_review_visibility",
    "simnet_proof_readiness",
  ].indexOf(stepId);
  return addMinutes(base, Math.max(offset, 0) * 5);
}

function addMinutes(iso: string, minutes: number): string {
  const timestamp = Date.parse(iso);
  return Number.isNaN(timestamp) ? new Date().toISOString() : new Date(timestamp + minutes * 60_000).toISOString();
}

function compactLookup(lookupCode: string): string {
  return lookupCode.replace(/[^a-zA-Z0-9]/g, "").slice(-18).toLowerCase() || "unknown";
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
