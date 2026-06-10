import { describe, expect, it } from "vitest";

import { createProtocolFixtureScenario } from "../protocol-fixtures";

describe("protocol fixture builders", () => {
  it("builds a deterministic funded BTC fixture scenario", () => {
    const scenario = createProtocolFixtureScenario();

    expect(scenario.loanRequest.borrowAsset).toBe("BTC");
    expect(scenario.loanRequest.collateralAsset).toBe("DCR");
    expect(scenario.quote.activationEligible).toBe(true);
    expect(scenario.quote.fundingState.status).toBe("funded");
    expect(scenario.quote.platformFee.totalFeeAmount).toBe(1);
    expect(scenario.quote.platformFee.platformAmount).toBeCloseTo(0.7);
    expect(scenario.quote.platformFee.arbiterReserveAmount).toBeCloseTo(0.3);
  });

  it("anchors evidence and includes the payload in the collateral template", () => {
    const scenario = createProtocolFixtureScenario();
    const evidenceOutput = scenario.collateralTemplate.outputs.find((output) => output.kind === "evidence_commitment");

    expect(scenario.evidenceRecord.status).toBe("anchored");
    expect(scenario.evidenceRecord.commitmentHash).toBe(scenario.evidenceCommitment.commitmentHash);
    expect(evidenceOutput?.payloadHex).toBe(scenario.evidenceRecord.commitmentPayloadHex);
  });

  it("creates confirmed collateral and disbursement observations", () => {
    const scenario = createProtocolFixtureScenario();

    expect(scenario.collateralObservation.status).toBe("confirmed");
    expect(scenario.collateralObservation.blockers).toEqual([]);
    expect(scenario.disbursementObservations).toHaveLength(1);
    expect(scenario.disbursementObservations[0].status).toBe("confirmed");
    expect(scenario.disbursementObservations[0].blockers).toEqual([]);
  });

  it("keeps the collateral template in unsigned-preview state with fallback path disabled", () => {
    const scenario = createProtocolFixtureScenario();
    const fallbackPath = scenario.collateralTemplate.spendPaths.find((path) => path.path === "fallback_liquidation_review");

    expect(scenario.collateralTemplate.status).toBe("ready_for_unsigned_preview");
    expect(fallbackPath?.enabled).toBe(false);
    expect(fallbackPath?.blockers).toHaveLength(1);
  });
});
