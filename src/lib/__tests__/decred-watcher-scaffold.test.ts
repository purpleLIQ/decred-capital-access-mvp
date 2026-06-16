import { describe, expect, it } from "vitest";

import { createHeadlessLoanLifecycleRecord, type HeadlessLoanLifecycleRecord, type OptionalBorrowerContact } from "../headless-loan-lifecycle";
import type { HeadlessLifecycleStore, LifecycleStatusSectionKey } from "../headless-lifecycle-store";
import type { LifecycleStatusSection } from "../headless-loan-lifecycle";
import { applyHeadlessLifecycleEvent } from "../headless-lifecycle-transitions";
import { createFixtureDecredWatcherEvent, type DecredExpectedOutputTerms } from "../decred-watcher-events";
import { verifyDcrCollateralLock, verifyDcrPlatformFeeOutput } from "../decred-watcher-verifiers";
import { createFixtureWatcherLifecycleEvent } from "../decred-watcher-fixtures";

class MemoryLifecycleStore implements HeadlessLifecycleStore {
  records: HeadlessLoanLifecycleRecord[] = [];

  async save(record: HeadlessLoanLifecycleRecord) {
    this.records = [record, ...this.records.filter((existing) => existing.lookupCode !== record.lookupCode)];
    return record;
  }

  async findByLookupCode(lookupCode: string) {
    return this.records.find((record) => record.lookupCode.toUpperCase() === lookupCode.trim().toUpperCase()) ?? null;
  }

  async listRecent(limit = 10) {
    return this.records.slice(0, limit);
  }

  async updateBorrowerContact(lookupCode: string, contact: OptionalBorrowerContact) {
    const record = await this.findByLookupCode(lookupCode);
    if (!record) return null;
    const nextRecord = { ...record, borrowerContact: contact };
    await this.save(nextRecord);
    return nextRecord;
  }

  async updateStatusSection(lookupCode: string, _section: LifecycleStatusSectionKey, _patch: Partial<LifecycleStatusSection<string>>) {
    return this.findByLookupCode(lookupCode);
  }
}

const expectedCollateral: DecredExpectedOutputTerms = {
  lookupCode: "DCL-DCR-001",
  expectedAmountDcr: 100,
  expectedAddressOrScript: "dcr-escrow-script-placeholder",
  minConfirmations: 2,
  network: "simnet",
};

const expectedPlatformFee: DecredExpectedOutputTerms = {
  lookupCode: "DCL-DCR-001",
  expectedAmountDcr: 1,
  expectedAddressOrScript: "dcr-platform-fee-address-placeholder",
  minConfirmations: 2,
  network: "simnet",
};

function seededStore() {
  const store = new MemoryLifecycleStore();
  const record = createHeadlessLoanLifecycleRecord({
    publicLoanReference: "DCL-DCR-001",
    collateralDcr: 100,
    borrowAmount: 1000,
    borrowAsset: "USDC",
    borrowerAcceptedQuote: true,
  });
  void store.save(record);
  return { store, record };
}

describe("Decred watcher scaffold", () => {
  it("verifies a confirmed collateral output", () => {
    const event = createFixtureDecredWatcherEvent({
      lookupCode: "DCL-DCR-001",
      kind: "collateral_confirmed",
      txid: "collateral-tx",
      outputIndex: 0,
      amountDcr: 100,
      expectedAmountDcr: 100,
      expectedAddressOrScript: expectedCollateral.expectedAddressOrScript,
      observedAddressOrScript: expectedCollateral.expectedAddressOrScript,
      confirmations: 2,
    });

    const result = verifyDcrCollateralLock(event, expectedCollateral);

    expect(result.status).toBe("confirmed");
    expect(result.safeToProceed).toBe(true);
  });

  it("verifies platform fee output mismatch states", () => {
    const missing = createFixtureDecredWatcherEvent({
      lookupCode: "DCL-DCR-001",
      kind: "platform_fee_output_missing",
      expectedAmountDcr: 1,
      expectedAddressOrScript: expectedPlatformFee.expectedAddressOrScript,
    });
    const mismatch = createFixtureDecredWatcherEvent({
      lookupCode: "DCL-DCR-001",
      kind: "platform_fee_output_mismatch",
      txid: "fee-tx",
      outputIndex: 1,
      amountDcr: 0.5,
      expectedAmountDcr: 1,
      expectedAddressOrScript: expectedPlatformFee.expectedAddressOrScript,
      observedAddressOrScript: expectedPlatformFee.expectedAddressOrScript,
      confirmations: 2,
    });

    expect(verifyDcrPlatformFeeOutput(missing, expectedPlatformFee).status).toBe("missing");
    expect(verifyDcrPlatformFeeOutput(mismatch, expectedPlatformFee).status).toBe("amount_mismatch");
    expect(verifyDcrPlatformFeeOutput(mismatch, expectedPlatformFee).blocksActivation).toBe(true);
  });

  it("maps valid fixture events into lifecycle section updates", async () => {
    const { store, record } = seededStore();
    const collateralEvent = createFixtureWatcherLifecycleEvent({
      scenario: "valid_collateral_lock_observed",
      lookupCode: record.lookupCode,
      expectedCollateral,
      expectedPlatformFee,
      observedAt: "2026-06-16T18:00:00.000Z",
    });
    const feeEvent = createFixtureWatcherLifecycleEvent({
      scenario: "valid_platform_fee_output_observed",
      lookupCode: record.lookupCode,
      expectedCollateral,
      expectedPlatformFee,
      observedAt: "2026-06-16T18:01:00.000Z",
    });

    const collateralResult = await applyHeadlessLifecycleEvent(collateralEvent, store);
    const feeResult = await applyHeadlessLifecycleEvent(feeEvent, store);

    expect(collateralResult?.record.collateralLock.status).toBe("locked");
    expect(collateralResult?.record.lifecycleStatus).toBe("awaiting_supplier_disbursement");
    expect(feeResult?.record.dcrPlatformFeeOutput.status).toBe("detected");
    expect(feeEvent.payload.platformFeeVerifierStatus).toBe("valid");
  });

  it("maps missing fee, stale watcher, and reorged collateral to non-confirmed lifecycle states", async () => {
    const { store, record } = seededStore();
    const missingFee = createFixtureWatcherLifecycleEvent({
      scenario: "missing_fee_output",
      lookupCode: record.lookupCode,
      expectedCollateral,
      expectedPlatformFee,
      observedAt: "2026-06-16T18:02:00.000Z",
    });
    const stale = createFixtureWatcherLifecycleEvent({
      scenario: "stale_watcher",
      lookupCode: record.lookupCode,
      expectedCollateral,
      expectedPlatformFee,
      observedAt: "2026-06-16T18:03:00.000Z",
    });
    const reorged = createFixtureWatcherLifecycleEvent({
      scenario: "reorged_collateral_event",
      lookupCode: record.lookupCode,
      expectedCollateral,
      expectedPlatformFee,
      observedAt: "2026-06-16T18:04:00.000Z",
    });

    const feeResult = await applyHeadlessLifecycleEvent(missingFee, store);
    const staleResult = await applyHeadlessLifecycleEvent(stale, store);
    const reorgResult = await applyHeadlessLifecycleEvent(reorged, store);

    expect(missingFee.payload.platformFeeVerifierStatus).toBe("missing");
    expect(feeResult?.record.dcrPlatformFeeOutput.status).toBe("not_started");
    expect(stale.payload.collateralVerifierStatus).toBe("stale");
    expect(staleResult?.record.collateralLock.status).toBe("failed");
    expect(reorged.payload.collateralVerifierStatus).toBe("reorged");
    expect(reorgResult?.record.collateralLock.status).toBe("failed");
  });
});
