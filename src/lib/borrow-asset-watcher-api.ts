import type { HeadlessLoanLifecycleRecord } from "./headless-loan-lifecycle";
import type { HeadlessLifecycleStore } from "./headless-lifecycle-store";
import type { HeadlessLifecycleEvent } from "./headless-lifecycle-events";
import type { HeadlessLifecycleEventStore } from "./lifecycle-event-store";
import type { BorrowAssetExpectedSettlementTerms } from "./borrow-asset-watcher-events";
import { createFixtureBorrowAssetLifecycleEvent, type BorrowAssetWatcherFixtureScenario } from "./borrow-asset-watcher-fixtures";
import { submitHeadlessLifecycleEvent, type LifecycleEventApiResult } from "./headless-lifecycle-event-api";

export async function submitFixtureBorrowAssetWatcherScenario(input: {
  scenario: BorrowAssetWatcherFixtureScenario;
  lookupCode: string;
  lifecycle: HeadlessLoanLifecycleRecord;
  expectedDisbursement: BorrowAssetExpectedSettlementTerms;
  expectedRepayment: BorrowAssetExpectedSettlementTerms;
  observedAt?: string;
  stores?: {
    lifecycleStore?: HeadlessLifecycleStore;
    eventStore?: HeadlessLifecycleEventStore;
  };
}): Promise<LifecycleEventApiResult<{ event: HeadlessLifecycleEvent; record: HeadlessLoanLifecycleRecord; affectedSection: string }>> {
  const lifecycleEvent = createFixtureBorrowAssetLifecycleEvent({
    scenario: input.scenario,
    lookupCode: input.lookupCode,
    lifecycle: input.lifecycle,
    expectedDisbursement: input.expectedDisbursement,
    expectedRepayment: input.expectedRepayment,
    observedAt: input.observedAt,
  });

  return submitHeadlessLifecycleEvent(lifecycleEvent, input.stores);
}
