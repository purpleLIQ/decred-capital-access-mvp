import { z } from "zod";
import { formatSchemaError } from "./api-schemas";
import type { HeadlessLoanLifecycleRecord } from "./headless-loan-lifecycle";
import type { HeadlessLifecycleStore } from "./headless-lifecycle-store";
import { headlessLifecycleStore } from "./headless-lifecycle-store";
import type { HeadlessLifecycleEventStore } from "./lifecycle-event-store";
import { lifecycleEventStore } from "./lifecycle-event-store";
import {
  createHeadlessLifecycleEvent,
  getAffectedLifecycleSection,
  type HeadlessLifecycleEvent,
  type HeadlessLifecycleEventKind,
  type HeadlessLifecycleEventSource,
} from "./headless-lifecycle-events";
import { applyHeadlessLifecycleEvent } from "./headless-lifecycle-transitions";

const eventKindSchema = z.enum([
  "borrower_quote_accepted",
  "borrower_contact_updated",
  "collateral_lock_observed",
  "dcr_platform_fee_output_observed",
  "supplier_disbursement_ready",
  "supplier_disbursement_observed",
  "repayment_observed",
  "collateral_release_ready",
  "collateral_release_observed",
  "liquidation_health_updated",
  "arbiter_review_requested",
  "arbiter_review_resolved",
  "evidence_bundle_prepared",
  "evidence_commitment_observed",
  "evidence_timestamp_prepared",
  "evidence_timestamp_submitted",
  "evidence_timestamp_anchored",
  "evidence_timestamp_verified",
  "evidence_timestamp_failed",
]);

const eventSourceSchema = z.enum(["borrower", "supplier", "arbiter", "operator", "watcher", "oracle", "system"]);
const eventAssetSchema = z.enum(["USDC", "USDT", "BTC", "DCR"]);
const digestAlgorithmSchema = z.enum(["sha256_placeholder", "blake256", "merkle_root"]);
const timestampProviderSchema = z.enum(["dcrtime", "decred_wallet_timestamp", "manual", "none"]);
const timestampVerificationSchema = z.enum(["not_checked", "pending", "verified", "failed"]);
const decredNetworkSchema = z.enum(["simnet", "testnet", "mainnet", "unknown"]);
const watcherRiskSchema = z.enum(["normal", "stale", "reorg_risk", "reorged", "unfinalized"]);
const collateralVerifierSchema = z.enum(["observed_unconfirmed", "confirmed", "amount_mismatch", "destination_mismatch", "stale", "reorged", "missing"]);
const platformFeeVerifierSchema = z.enum(["valid", "missing", "amount_mismatch", "destination_mismatch", "unconfirmed", "stale", "reorged"]);
const borrowAssetRailSchema = z.enum(["bitcoin_simnet", "bitcoin_testnet", "bitcoin_mainnet", "evm_local", "evm_testnet", "evm_mainnet", "unknown"]);
const supplierDisbursementVerifierSchema = z.enum(["valid", "missing", "amount_mismatch", "destination_mismatch", "asset_mismatch", "token_contract_mismatch", "unconfirmed", "stale", "reorged"]);
const repaymentVerifierSchema = z.enum(["valid_full_repayment", "valid_partial_repayment", "missing", "amount_mismatch", "destination_mismatch", "asset_mismatch", "token_contract_mismatch", "unconfirmed", "stale", "reorged"]);

const eventSubmitSchema = z.object({
  lookupCode: z.string().trim().min(1).max(120),
  kind: eventKindSchema,
  source: eventSourceSchema,
  payload: z.object({
    status: z.string().optional(),
    detail: z.string().trim().min(1).max(1000),
    amount: z.coerce.number().nonnegative().optional(),
    asset: eventAssetSchema.optional(),
    txid: z.string().trim().max(160).optional(),
    watcherEventId: z.string().trim().max(160).optional(),
    evidenceId: z.string().trim().max(160).optional(),
    reviewId: z.string().trim().max(160).optional(),
    health: z.string().trim().max(80).optional(),
    repaymentAmount: z.coerce.number().nonnegative().optional(),
    evidenceHash: z.string().trim().max(160).optional(),
    digestAlgorithm: digestAlgorithmSchema.optional(),
    timestampProvider: timestampProviderSchema.optional(),
    submittedAt: z.string().datetime().optional(),
    anchoredAt: z.string().datetime().optional(),
    chainTimestamp: z.string().datetime().optional(),
    merkleRoot: z.string().trim().max(160).optional(),
    merklePathPlaceholder: z.string().trim().max(1000).optional(),
    verificationStatus: timestampVerificationSchema.optional(),
    publicSummaryId: z.string().trim().max(160).optional(),
    timestampAuditNote: z.string().trim().max(1000).optional(),
    decredWatcherKind: z.string().trim().max(120).optional(),
    decredNetwork: decredNetworkSchema.optional(),
    outputIndex: z.coerce.number().int().nonnegative().optional(),
    expectedAmountDcr: z.coerce.number().nonnegative().optional(),
    expectedAddressOrScript: z.string().trim().max(240).optional(),
    observedAddressOrScript: z.string().trim().max(240).optional(),
    confirmations: z.coerce.number().int().nonnegative().optional(),
    blockHeight: z.coerce.number().int().nonnegative().optional(),
    blockHash: z.string().trim().max(160).optional(),
    watcherRiskStatus: watcherRiskSchema.optional(),
    collateralVerifierStatus: collateralVerifierSchema.optional(),
    platformFeeVerifierStatus: platformFeeVerifierSchema.optional(),
    borrowAssetWatcherKind: z.string().trim().max(120).optional(),
    borrowAssetRailNetwork: borrowAssetRailSchema.optional(),
    supplierPositionId: z.string().trim().max(160).optional(),
    supplierFillId: z.string().trim().max(160).optional(),
    logIndex: z.coerce.number().int().nonnegative().optional(),
    tokenContract: z.string().trim().max(160).optional(),
    fromAddress: z.string().trim().max(200).optional(),
    toAddress: z.string().trim().max(200).optional(),
    expectedAmount: z.coerce.number().nonnegative().optional(),
    finalityDepth: z.coerce.number().int().nonnegative().optional(),
    supplierDisbursementVerifierStatus: supplierDisbursementVerifierSchema.optional(),
    repaymentVerifierStatus: repaymentVerifierSchema.optional(),
  }),
  observedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime().optional(),
  externalReference: z.string().trim().max(200).optional(),
  safetyAuditNote: z.string().trim().max(1000).optional(),
});

const eventListSchema = z.object({
  lookupCode: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(25),
});

export interface LifecycleEventApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export async function submitHeadlessLifecycleEvent(
  input: unknown,
  stores: {
    lifecycleStore?: HeadlessLifecycleStore;
    eventStore?: HeadlessLifecycleEventStore;
  } = {},
): Promise<LifecycleEventApiResult<{ event: HeadlessLifecycleEvent; record: HeadlessLoanLifecycleRecord; affectedSection: string }>> {
  const parsed = eventSubmitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, error: formatSchemaError(parsed.error) };

  const lifecycleStore = stores.lifecycleStore ?? headlessLifecycleStore;
  const eventStore = stores.eventStore ?? lifecycleEventStore;
  const event = createHeadlessLifecycleEvent({
    lookupCode: parsed.data.lookupCode,
    kind: parsed.data.kind as HeadlessLifecycleEventKind,
    source: parsed.data.source as HeadlessLifecycleEventSource,
    payload: parsed.data.payload,
    observedAt: parsed.data.observedAt,
    createdAt: parsed.data.createdAt,
    externalReference: parsed.data.externalReference,
    safetyAuditNote: parsed.data.safetyAuditNote,
  });
  const result = await applyHeadlessLifecycleEvent(event, lifecycleStore);
  if (!result) return { ok: false, status: 404, error: "Loan reference not found." };

  const savedEvent = await eventStore.save(event);

  return {
    ok: true,
    status: 201,
    data: {
      event: savedEvent,
      record: result.record,
      affectedSection: result.affectedSection,
    },
  };
}

export async function listHeadlessLifecycleEvents(
  input: unknown,
  eventStore: HeadlessLifecycleEventStore = lifecycleEventStore,
): Promise<LifecycleEventApiResult<{ events: HeadlessLifecycleEvent[] }>> {
  const parsed = eventListSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, error: formatSchemaError(parsed.error) };

  const events = parsed.data.lookupCode
    ? await eventStore.listByLookupCode(parsed.data.lookupCode, parsed.data.limit)
    : await eventStore.listRecent(parsed.data.limit);

  return { ok: true, status: 200, data: { events } };
}

export function getLifecycleEventAffectedSection(kind: HeadlessLifecycleEventKind): string {
  return getAffectedLifecycleSection(kind);
}
