import { describe, expect, it } from "vitest";

import { getDemoProtocolScenario } from "../demo-scenario-adapter";

describe("demo protocol scenario adapter", () => {
  it("returns a read-only funded BTC/DCR protocol scenario", () => {
    const scenario = getDemoProtocolScenario();

    expect(scenario.loanRequestId).toBe("loan-request-fixture-1");
    expect(scenario.borrowAsset).toBe("BTC");
    expect(scenario.collateralAsset).toBe("DCR");
    expect(scenario.fundingStatus).toBe("funded");
    expect(scenario.activationEligible).toBe(true);
    expect(scenario.supplierCount).toBe(1);
  });

  it("summarizes confirmed watcher and evidence state", () => {
    const scenario = getDemoProtocolScenario();

    expect(scenario.collateralTemplateStatus).toBe("ready_for_unsigned_preview");
    expect(scenario.collateralObservationStatus).toBe("confirmed");
    expect(scenario.disbursementObservationStatuses).toEqual(["confirmed"]);
    expect(scenario.evidenceRecordStatus).toBe("anchored");
    expect(scenario.evidenceCommitmentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps adapter notes explicitly read-only", () => {
    const scenario = getDemoProtocolScenario();

    expect(scenario.notes).toContain("Read-only protocol scenario fixture.");
    expect(scenario.notes).toContain("No execution path is exposed through this adapter.");
  });
});
