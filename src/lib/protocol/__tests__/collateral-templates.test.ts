import { describe, expect, it } from "vitest";

import {
  calculatePlatformFeeBreakdown,
  createCollateralContractTemplate,
  createDecredEvidenceCommitmentRecord,
  createEvidenceHashCommitment,
  DEFAULT_SIMNET_COLLATERAL_POLICY,
  getEnabledSpendPaths,
  type CollateralTemplateInput,
  type EvidenceBundle,
} from "..";

const evidenceBundle: EvidenceBundle = {
  id: "evidence-1",
  loanId: "loan-1",
  decisionId: "decision-1",
  policyVersion: "policy-v0",
  createdAt: "2026-06-09T03:00:00.000Z",
  collateralAsset: "DCR",
  collateralAmount: 100,
  borrowAsset: "BTC",
  borrowAmount: 1,
  oracleSnapshots: [],
  ltvBps: 6000,
  warningThresholdBps: 6500,
  liquidationThresholdBps: 7500,
  graceWindowOpen: false,
  arbiterWindowOpen: false,
  watcherConfirmations: 6,
  transactionTemplateIds: ["template-1"],
  blockers: [],
  warnings: [],
  recommendedAction: "none",
  status: "ready_for_review",
};

const platformFee = calculatePlatformFeeBreakdown(100);
const evidenceCommitment = createDecredEvidenceCommitmentRecord({
  id: "commitment-1",
  commitment: createEvidenceHashCommitment(evidenceBundle),
  network: "decred_simnet",
  preparedAt: "2026-06-09T04:00:00.000Z",
});

const baseInput: CollateralTemplateInput = {
  id: "collateral-template-1",
  loanId: "loan-1",
  collateralAsset: "DCR",
  collateralAmount: 100,
  escrowAddress: "DsEscrow",
  participantKeys: {
    borrowerPubkey: "borrower-pubkey",
    supplierPubkey: "supplier-pubkey",
    arbiterPubkey: "arbiter-pubkey",
  },
  platformFee,
  platformFeeAddress: "DsPlatformFee",
  arbiterReserveAddress: "DsArbiterReserve",
  evidenceCommitment,
  policy: DEFAULT_SIMNET_COLLATERAL_POLICY,
  createdAt: "2026-06-09T05:00:00.000Z",
};

describe("collateral template scaffolding", () => {
  it("creates a simnet collateral template ready for unsigned preview", () => {
    const template = createCollateralContractTemplate(baseInput);

    expect(template.status).toBe("ready_for_unsigned_preview");
    expect(template.blockers).toEqual([]);
    expect(template.network).toBe("decred_simnet");
    expect(template.requiredConfirmations).toBe(6);
    expect(template.collateralAsset).toBe("DCR");
  });

  it("requires collateral, platform fee, and arbiter reserve outputs", () => {
    const template = createCollateralContractTemplate(baseInput);

    expect(template.outputs).toEqual(
      expect.arrayContaining([
        {
          kind: "collateral",
          address: "DsEscrow",
          amount: 100,
          required: true,
        },
        {
          kind: "platform_fee",
          address: "DsPlatformFee",
          amount: 0.7,
          required: true,
        },
        {
          kind: "arbiter_reserve",
          address: "DsArbiterReserve",
          amount: 0.30000000000000004,
          required: true,
        },
      ]),
    );
  });

  it("includes optional evidence commitment payload output", () => {
    const template = createCollateralContractTemplate(baseInput);
    const evidenceOutput = template.outputs.find((output) => output.kind === "evidence_commitment");

    expect(evidenceOutput).toMatchObject({
      kind: "evidence_commitment",
      payloadHex: evidenceCommitment.commitmentPayloadHex,
      required: false,
    });
  });

  it("enables borrower and arbiter spend paths while blocking fallback review", () => {
    const template = createCollateralContractTemplate(baseInput);
    const enabledPaths = getEnabledSpendPaths(template).map((path) => path.path);
    const fallback = template.spendPaths.find((path) => path.path === "fallback_liquidation_review");

    expect(enabledPaths).toEqual(["borrower_release", "arbiter_release", "arbiter_liquidation_review"]);
    expect(fallback?.enabled).toBe(false);
    expect(fallback?.blockers).toHaveLength(1);
  });

  it("blocks mainnet templates unless policy explicitly allows them", () => {
    const template = createCollateralContractTemplate({
      ...baseInput,
      policy: {
        ...DEFAULT_SIMNET_COLLATERAL_POLICY,
        network: "decred_mainnet",
        allowMainnet: false,
      },
    });

    expect(template.status).toBe("blocked");
    expect(template.blockers).toContain("Mainnet collateral templates require explicit policy enablement.");
  });

  it("blocks templates with missing participant keys", () => {
    const template = createCollateralContractTemplate({
      ...baseInput,
      participantKeys: {
        ...baseInput.participantKeys,
        arbiterPubkey: "",
      },
    });

    expect(template.status).toBe("blocked");
    expect(template.blockers).toContain("arbiterPubkey is required.");
  });
});
