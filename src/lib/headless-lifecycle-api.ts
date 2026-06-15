import { z } from "zod";
import {
  createHeadlessLoanLifecycleRecord,
  type HeadlessLoanLifecycleRecord,
  type OptionalBorrowerContact,
} from "./headless-loan-lifecycle";
import { borrowAssetSchema, formatSchemaError } from "./api-schemas";
import { headlessLifecycleStore, type HeadlessLifecycleStore } from "./headless-lifecycle-store";

const createRequestSchema = z.object({
  collateralDcr: z.coerce.number().positive().max(100000),
  borrowAmount: z.coerce.number().positive().max(1000000),
  borrowAsset: borrowAssetSchema.default("USDC"),
  borrowerAcceptedPartialFunding: z.boolean().optional().default(false),
  borrowerContact: z
    .object({
      preference: z.enum(["none", "email", "other"]).optional(),
      value: z.string().trim().max(320).optional(),
      consentForUpdates: z.boolean().optional(),
    })
    .optional(),
  repaymentAmount: z.coerce.number().nonnegative().optional(),
  requestedAmountUsd: z.coerce.number().nonnegative().optional(),
  durationDays: z.coerce.number().int().positive().max(365).optional(),
});

const lookupRequestSchema = z.object({ lookupCode: z.string().trim().min(1).max(120) });

const contactRequestSchema = z.object({
  lookupCode: z.string().trim().min(1).max(120),
  borrowerContact: z.object({
    preference: z.enum(["none", "email", "other"]).default("email"),
    value: z.string().trim().max(320).optional(),
    consentForUpdates: z.boolean().default(true),
  }),
});

export interface LifecycleApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export async function createAndSaveHeadlessLifecycle(
  input: unknown,
  store: HeadlessLifecycleStore = headlessLifecycleStore,
): Promise<LifecycleApiResult<{ record: HeadlessLoanLifecycleRecord }>> {
  const parsed = createRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, error: formatSchemaError(parsed.error) };

  const record = createHeadlessLoanLifecycleRecord({ ...parsed.data, borrowerAcceptedQuote: true });
  const saved = await store.save(record);
  return { ok: true, status: 201, data: { record: saved } };
}

export async function lookupHeadlessLifecycle(
  input: unknown,
  store: HeadlessLifecycleStore = headlessLifecycleStore,
): Promise<LifecycleApiResult<{ record: HeadlessLoanLifecycleRecord | null }>> {
  const parsed = lookupRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, error: formatSchemaError(parsed.error) };

  const record = await store.findByLookupCode(parsed.data.lookupCode);
  return { ok: true, status: 200, data: { record } };
}

export async function listRecentHeadlessLifecycles(
  limit = 10,
  store: HeadlessLifecycleStore = headlessLifecycleStore,
): Promise<LifecycleApiResult<{ records: HeadlessLoanLifecycleRecord[] }>> {
  const records = await store.listRecent(limit);
  return { ok: true, status: 200, data: { records } };
}

export async function updateHeadlessLifecycleBorrowerContact(
  input: unknown,
  store: HeadlessLifecycleStore = headlessLifecycleStore,
): Promise<LifecycleApiResult<{ record: HeadlessLoanLifecycleRecord | null }>> {
  const parsed = contactRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, error: formatSchemaError(parsed.error) };

  const record = await store.updateBorrowerContact(parsed.data.lookupCode, normalizeContact(parsed.data.borrowerContact));
  if (!record) return { ok: false, status: 404, error: "Loan reference not found." };
  return { ok: true, status: 200, data: { record } };
}

function normalizeContact(input: z.infer<typeof contactRequestSchema>["borrowerContact"]): OptionalBorrowerContact {
  if (!input.value) {
    return {
      preference: "none",
      consentForUpdates: false,
      note: "Borrower skipped contact info; lookup code is the recovery path.",
    };
  }

  return {
    preference: input.preference,
    value: input.value,
    consentForUpdates: input.consentForUpdates,
    note: "Optional borrower contact is for updates and recovery only, not account creation.",
  };
}
