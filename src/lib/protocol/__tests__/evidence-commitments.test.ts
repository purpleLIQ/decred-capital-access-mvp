import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  createDecredEvidenceCommitmentRecord,
  createEvidenceHashCommitment,
  markEvidenceCommitmentAnchored,
  type EvidenceBundle,
} from "..";

const bundle: EvidenceBundle = {
  id: "evidence-1",
  loanId: "loan-1",
  decisionId: "decision-1",
  policyVersion: "policy-v0",
  createdAt: "2026-06-09T03:00:00.000Z",
  collateralAsset: "DCR",
  collateralAmount: 100,
  borrowAsset: "BTC",
  borrowAmount: 1,
  oracleSnapshots: [
    {
      source: "oracle-b",
      observedAt: "2026-06-09T03:00:00.000Z",
      dcrUsdPrice: 20,
      borrowAssetUsdPrice: 100_000,
      healthy: true,
    },
  ],
  ltvBps: 6000,
  warningThresholdBps: 6500,
  liquidationThresholdBps: 7500,
  graceWindowOpen: false,
  arbiterWindowOpen: false,
  watcherConfirmations: 6,
  transactionTemplateIds: ["template-1"],
  blockers: ["No execution path is enabled."],
  warnings: ["Demo evidence only."],
  recommendedAction: "none",
  status: "ready_for_review",
};

describe("evidence commitment scaffolding", () => {
  it("creates stable canonical JSON independent of object key insertion order", () => {
    const first = canonicalJson({ b: 2, a: { d: 4, c: 3 } });
    const second = canonicalJson({ a: { c: 3, d: 4 }, b: 2 });

    expect(first).toBe(second);
    expect(first).toBe('{"a":{"c":3,"d":4},"b":2}');
  });

  it("creates deterministic evidence hash commitments", () => {
    const first = createEvidenceHashCommitment(bundle);
    const second = createEvidenceHashCommitment({ ...bundle });

    expect(first.algorithm).toBe("sha256");
    expect(first.commitmentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.commitmentHash).toBe(second.commitmentHash);
    expect(first.canonicalPayload).toBe(second.canonicalPayload);
  });

  it("keeps public summaries privacy-safe", () => {
    const commitment = createEvidenceHashCommitment(bundle);

    expect(commitment.publicSummary).toEqual({
      evidenceId: "evidence-1",
      loanId: "loan-1",
      decisionId: "decision-1",
      policyVersion: "policy-v0",
      createdAt: "2026-06-09T03:00:00.000Z",
      borrowAsset: "BTC",
      status: "ready_for_review",
      recommendedAction: "none",
      ltvBps: 6000,
      warningCount: 1,
      blockerCount: 1,
      oracleSnapshotCount: 1,
    });
    expect(JSON.stringify(commitment.publicSummary)).not.toContain("collateralAmount");
    expect(JSON.stringify(commitment.publicSummary)).not.toContain("transactionTemplateIds");
  });

  it("prepares a Decred evidence commitment record without anchoring it", () => {
    const commitment = createEvidenceHashCommitment(bundle);
    const record = createDecredEvidenceCommitmentRecord({
      id: "commitment-1",
      commitment,
      network: "decred_simnet",
      preparedAt: "2026-06-09T04:00:00.000Z",
    });

    expect(record.status).toBe("prepared");
    expect(record.commitmentHash).toBe(commitment.commitmentHash);
    expect(record.commitmentPayloadHex).toBe(
      Buffer.from(`DCA_EVIDENCE:${commitment.commitmentHash}`, "utf8").toString("hex"),
    );
    expect(record.anchoredTxid).toBeUndefined();
  });

  it("marks a prepared Decred evidence commitment as anchored", () => {
    const commitment = createEvidenceHashCommitment(bundle);
    const record = createDecredEvidenceCommitmentRecord({
      id: "commitment-1",
      commitment,
      network: "decred_simnet",
      preparedAt: "2026-06-09T04:00:00.000Z",
    });
    const anchored = markEvidenceCommitmentAnchored({
      record,
      anchoredTxid: "dcr-evidence-tx",
      anchoredAt: "2026-06-09T04:05:00.000Z",
      blockHeight: 123,
    });

    expect(anchored.status).toBe("anchored");
    expect(anchored.anchoredTxid).toBe("dcr-evidence-tx");
    expect(anchored.blockHeight).toBe(123);
  });
});
