import type { HeadlessLoanLifecycleRecord } from "./headless-loan-lifecycle";
import type { HeadlessLifecycleStore } from "./headless-lifecycle-store";
import type { HeadlessLifecycleEvent } from "./headless-lifecycle-events";
import type { HeadlessLifecycleEventStore } from "./lifecycle-event-store";
import type { DecredExpectedOutputTerms } from "./decred-watcher-events";
import { createFixtureWatcherLifecycleEvent, type DecredWatcherFixtureScenario } from "./decred-watcher-fixtures";
import { submitHeadlessLifecycleEvent, type LifecycleEventApiResult } from "./headless-lifecycle-event-api";

export async function submitFixtureDecredWatcherScenario(input: {
  scenario: DecredWatcherFixtureScenario;
  lookupCode: string;
  expectedCollateral: DecredExpectedOutputTerms;
  expectedPlatformFee: DecredExpectedOutputTerms;
  observedAt?: string;
  stores?: {
    lifecycleStore?: HeadlessLifecycleStore;
    eventStore?: HeadlessLifecycleEventStore;
  };
}): Promise<LifecycleEventApiResult<{ event: HeadlessLifecycleEvent; record: HeadlessLoanLifecycleRecord; affectedSection: string }>> {
  const lifecycleEvent = createFixtureWatcherLifecycleEvent({
    scenario: input.scenario,
    lookupCode: input.lookupCode,
    expectedCollateral: input.expectedCollateral,
    expectedPlatformFee: input.expectedPlatformFee,
    observedAt: input.observedAt,
  });

  return submitHeadlessLifecycleEvent(lifecycleEvent, input.stores);
}
