import { z } from "zod";
import { formatSchemaError } from "./api-schemas";
import type { ArbiterCaseStore } from "./arbiter-case-store";
import { arbiterCaseStore } from "./arbiter-case-store";
import type { HeadlessLifecycleStore } from "./headless-lifecycle-store";
import { headlessLifecycleStore } from "./headless-lifecycle-store";
import type { HeadlessLifecycleEventStore } from "./lifecycle-event-store";
import { lifecycleEventStore } from "./lifecycle-event-store";
import {
  submitFixtureLiquidationHealthScenario,
  type LiquidationHealthFixtureScenarioName,
  type SubmittedLiquidationHealthFixtureScenario,
} from "./oracle-liquidation-health-fixtures";

export interface OracleLiquidationHealthApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

const scenarioSchema = z.enum([
  "healthy_loan",
  "warning_state",
  "margin_call_state",
  "liquidation_eligible_state",
  "stale_oracle",
  "deviated_oracle",
  "stale_watcher",
  "borrower_warning_opened",
  "top_up_requested",
  "arbiter_review_case_opened",
  "evidence_summary_prepared",
]);

const submitScenarioSchema = z.object({
  lookupCode: z.string().trim().min(1).max(120),
  scenario: scenarioSchema,
  now: z.string().datetime().optional(),
});

export async function submitOperatorFixtureLiquidationHealthScenario(
  input: unknown,
  stores: {
    lifecycleStore?: HeadlessLifecycleStore;
    eventStore?: HeadlessLifecycleEventStore;
    arbiterStore?: ArbiterCaseStore;
  } = {},
): Promise<OracleLiquidationHealthApiResult<SubmittedLiquidationHealthFixtureScenario>> {
  const parsed = submitScenarioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, error: formatSchemaError(parsed.error) };

  const lifecycleStore = stores.lifecycleStore ?? headlessLifecycleStore;
  const eventStore = stores.eventStore ?? lifecycleEventStore;
  const arbiterStore = stores.arbiterStore ?? arbiterCaseStore;
  const record = await lifecycleStore.findByLookupCode(parsed.data.lookupCode);
  if (!record) return { ok: false, status: 404, error: "Lifecycle record not found." };

  const submitted = await submitFixtureLiquidationHealthScenario({
    scenario: parsed.data.scenario as LiquidationHealthFixtureScenarioName,
    record,
    now: parsed.data.now,
    stores: { lifecycleStore, eventStore, arbiterStore },
  });

  return { ok: true, status: 201, data: submitted };
}

export const supportedLiquidationHealthFixtureScenarios = scenarioSchema.options;
