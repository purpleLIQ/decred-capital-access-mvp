import { describe, expect, it } from "vitest";

import { createHeadlessLoanLifecycleRecord, type HeadlessLoanLifecycleRecord, type OptionalBorrowerContact } from "../headless-loan-lifecycle";
import type { HeadlessLifecycleStore, LifecycleStatusSectionKey } from "../headless-lifecycle-store";
import type { LifecycleStatusSection } from "../headless-loan-lifecycle";
import type { HeadlessLifecycleEventStore } from "../lifecycle-event-store";
import type { HeadlessLifecycleEvent } from "../headless-lifecycle-events";
import type { BorrowAssetExpectedSettlementTerms } from "../borrow-asset-watcher-events";
import { createFixtureBorrowAssetWatcherEvent } from "../borrow-asset-watcher-events";
import { verifyBorrowerRepayment, verifySupplierDisbursement } from "../borrow-asset-watcher-verifiers";
import { createFixtureBorrowAssetLifecycleEvent } from "../borrow-asset-watcher-fixtures";
import { submitFixtureBorrowAssetWatcherScenario } from "../borrow-asset-watcher-api";
import { applyHeadlessLifecycleEvent } from "../headless-lifecycle-transitions";

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

class MemoryEventStore implements HeadlessLifecycleEventStore {
  events: HeadlessLifecycleEvent[] = [];

  async save(event: HeadlessLifecycleEvent) {
    this.events = [event, ...this.events.filter((existing) => existing.id !== event.id)];
    return event;
  }

  async listByLookupCode(lookupCode: string, limit = 20) {
    return this.events.filter((event) => event.lookupCode.toUpperCase() === lookupCode.trim().toUpperCase()).slice(0, limit);
  }

  async listRecent(limit = 25) {
    return this.events.slice(0, limit);
  }
}

function seededStore(asset: "BTC" | "USDC" | "USDT" = "USDC") {
  const store = new MemoryLifecycleStore();
  const record = createHeadlessLoanLifecycleRecord({
    publicLoanReference: `DCL-WATCH-${asset}`,
    collateralDcr: 100,
    borrowAmount: asset === "BTC" ? 0.01 : 1000,
    borrowAsset: asset,
    borrowerAcceptedQuote: true,
    repaymentAmount: 0,
  });
  void store.save(record);
  return { store, record };
}

function expectedDisbursement(record: HeadlessLoanLifecycleRecord): BorrowAssetExpectedSettlementTerms {
  const position = record.supplierPositions[0];
  return {
    lookupCode: record.lookupCode,
    supplierPositionId: position?.id ?? "position-fixture",
    supplierFillId: position?.fillId ?? "fill-fixture",
    asset: record.borrowAsset,
    railNetwork: record.borrowAsset === "BTC" ? "bitcoin_testnet" : "evm_testnet",
    expectedAmount: position?.principal ?? record.requestedAmount,
    expectedFromAddress: "supplier-funding-address",
    expectedToAddress: "borrower-receive-address",
    expectedTokenContract: record.borrowAsset === "BTC" ? undefined : `${record.borrowAsset.toLowerCase()}-token-contract`,
    minConfirmations: record.borrowAsset === "BTC" ? 2 : 0,
    minFinalityDepth: record.borrowAsset === "BTC" ? 0 : 12,
  };
}

function expectedRepayment(record: HeadlessLoanLifecycleRecord): BorrowAssetExpectedSettlementTerms {
  return {
    lookupCode: record.lookupCode,
    asset: record.borrowAsset,
    railNetwork: record.borrowAsset === "BTC" ? "bitcoin_testnet" : "evm_testnet",
    expectedAmount: record.repaymentAllocationPreview.totalDue,
    expectedFromAddress: "borrower-repayment-address",
    expectedToAddress: "supplier-repayment-collector",
    expectedTokenContract: record.borrowAsset === "BTC" ? undefined : `${record.borrowAsset.toLowerCase()}-token-contract`,
    minConfirmations: record.borrowAsset === "BTC" ? 2 : 0,
    minFinalityDepth: record.borrowAsset === "BTC" ? 0 : 12,
  };
}

describe("borrow-asset watcher scaffold", () => {
  it("verifies valid BTC, USDC, and USDT supplier disbursements", () => {
    for (const asset of ["BTC", "USDC", "USDT"] as const) {
      const { record } = seededStore(asset);
      const expected = expectedDisbursement(record);
      const event = createFixtureBorrowAssetWatcherEvent({
        lookupCode: record.lookupCode,
        kind: "supplier_disbursement_confirmed",
        supplierPositionId: expected.supplierPositionId,
        supplierFillId: expected.supplierFillId,
        asset,
        railNetwork: expected.railNetwork,
        txid: `fixture-${asset}-disbursement`,
        outputIndex: asset === "BTC" ? 0 : undefined,
        logIndex: asset === "BTC" ? undefined : 8,
        tokenContract: expected.expectedTokenContract,
        fromAddress: expected.expectedFromAddress,
        toAddress: expected.expectedToAddress,
        observedAmount: expected.expectedAmount,
        expectedAmount: expected.expectedAmount,
        confirmations: expected.minConfirmations,
        finalityDepth: expected.minFinalityDepth,
      });

      const result = verifySupplierDisbursement(event, expected);

      expect(result.status).toBe("valid");
      expect(result.safeToProceed).toBe(true);
    }
  });

  it("detects disbursement amount and destination mismatch", () => {
    const { record } = seededStore("USDC");
    const expected = expectedDisbursement(record);
    const amountMismatch = createFixtureBorrowAssetWatcherEvent({
      lookupCode: record.lookupCode,
      kind: "supplier_disbursement_mismatch",
      asset: "USDC",
      railNetwork: "evm_testnet",
      tokenContract: expected.expectedTokenContract,
      fromAddress: expected.expectedFromAddress,
      toAddress: expected.expectedToAddress,
      observedAmount: expected.expectedAmount / 2,
      expectedAmount: expected.expectedAmount,
      confirmations: 0,
      finalityDepth: 12,
    });
    const destinationMismatch = createFixtureBorrowAssetWatcherEvent({
      lookupCode: record.lookupCode,
      kind: "supplier_disbursement_mismatch",
      asset: "USDC",
      railNetwork: "evm_testnet",
      tokenContract: expected.expectedTokenContract,
      fromAddress: expected.expectedFromAddress,
      toAddress: "wrong-address",
      observedAmount: expected.expectedAmount,
      expectedAmount: expected.expectedAmount,
      confirmations: 0,
      finalityDepth: 12,
    });

    expect(verifySupplierDisbursement(amountMismatch, expected).status).toBe("amount_mismatch");
    expect(verifySupplierDisbursement(destinationMismatch, expected).status).toBe("destination_mismatch");
  });

  it("maps valid disbursement and repayment events into lifecycle updates", async () => {
    const { store, record } = seededStore("USDC");
    const disbursement = createFixtureBorrowAssetLifecycleEvent({
      scenario: "valid_usdc_supplier_disbursement",
      lookupCode: record.lookupCode,
      lifecycle: record,
      expectedDisbursement: expectedDisbursement(record),
      expectedRepayment: expectedRepayment(record),
      observedAt: "2026-06-16T21:00:00.000Z",
    });
    const partialRepayment = createFixtureBorrowAssetLifecycleEvent({
      scenario: "valid_partial_repayment",
      lookupCode: record.lookupCode,
      lifecycle: record,
      expectedDisbursement: expectedDisbursement(record),
      expectedRepayment: expectedRepayment(record),
      observedAt: "2026-06-16T21:01:00.000Z",
    });
    const fullRepayment = createFixtureBorrowAssetLifecycleEvent({
      scenario: "valid_full_repayment",
      lookupCode: record.lookupCode,
      lifecycle: record,
      expectedDisbursement: expectedDisbursement(record),
      expectedRepayment: expectedRepayment(record),
      observedAt: "2026-06-16T21:02:00.000Z",
    });

    const disbursementResult = await applyHeadlessLifecycleEvent(disbursement, store);
    const partialResult = await applyHeadlessLifecycleEvent(partialRepayment, store);
    const fullResult = await applyHeadlessLifecycleEvent(fullRepayment, store);

    expect(disbursement.payload.supplierDisbursementVerifierStatus).toBe("valid");
    expect(disbursementResult?.record.supplierDisbursement.status).toBe("disbursed");
    expect(disbursementResult?.record.lifecycleStatus).toBe("repayment_pending");
    expect(partialRepayment.payload.repaymentVerifierStatus).toBe("valid_partial_repayment");
    expect(partialResult?.record.repaymentDetection.status).toBe("partial");
    expect(fullRepayment.payload.repaymentVerifierStatus).toBe("valid_full_repayment");
    expect(fullResult?.record.repaymentDetection.status).toBe("detected");
    expect(fullResult?.record.collateralRelease.status).toBe("ready");
  });

  it("does not mark repayment complete for wrong asset, amount mismatch, stale, or reorged events", async () => {
    const { store, record } = seededStore("USDT");
    const scenarios = ["repayment_wrong_asset", "repayment_amount_mismatch", "stale_watcher", "reorged_watcher_event"] as const;

    for (const scenario of scenarios) {
      const lifecycleEvent = createFixtureBorrowAssetLifecycleEvent({
        scenario,
        lookupCode: record.lookupCode,
        lifecycle: record,
        expectedDisbursement: expectedDisbursement(record),
        expectedRepayment: expectedRepayment(record),
        observedAt: "2026-06-16T21:03:00.000Z",
      });
      const result = await applyHeadlessLifecycleEvent(lifecycleEvent, store);

      expect(lifecycleEvent.payload.repaymentVerifierStatus).not.toBe("valid_full_repayment");
      expect(result?.record.repaymentDetection.status).not.toBe("detected");
    }
  });

  it("submits fixture borrow-asset watcher scenarios through the event API/store seam", async () => {
    const { store, record } = seededStore("BTC");
    const eventStore = new MemoryEventStore();

    const submitted = await submitFixtureBorrowAssetWatcherScenario({
      scenario: "valid_btc_supplier_disbursement",
      lookupCode: record.lookupCode,
      lifecycle: record,
      expectedDisbursement: expectedDisbursement(record),
      expectedRepayment: expectedRepayment(record),
      observedAt: "2026-06-16T21:04:00.000Z",
      stores: { lifecycleStore: store, eventStore },
    });

    expect(submitted.ok).toBe(true);
    expect(submitted.data?.affectedSection).toBe("supplierDisbursement");
    expect(submitted.data?.record.supplierDisbursement.status).toBe("disbursed");
    expect(eventStore.events).toHaveLength(1);
    expect(eventStore.events[0].payload.borrowAssetWatcherKind).toBe("supplier_disbursement_confirmed");
  });
});
