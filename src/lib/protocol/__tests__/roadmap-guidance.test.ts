import { describe, expect, it } from "vitest";

import { createProtocolFixtureScenario } from "../protocol-fixtures";
import { createProtocolRoadmapGuidance } from "../roadmap-guidance";
import { createScenarioReviewReport } from "../../scenario-report";

function guidance() {
  const scenario = createProtocolFixtureScenario();
  const report = createScenarioReviewReport({ scenario, generatedAt: "2026-06-10T12:10:00.000Z" });

  return createProtocolRoadmapGuidance(report);
}

describe("protocol roadmap guidance", () => {
  it("guides supplier funding toward borrower quote integration", () => {
    const supplierFunding = guidance().find((item) => item.track === "supplier_funding");

    expect(supplierFunding?.currentImplementationStatus).toBe("partial");
    expect(supplierFunding?.scenarioStatus).toBe("pass");
    expect(supplierFunding?.roadmapPhase).toBe("supplier offer UX");
    expect(supplierFunding?.nextBuildStep).toBe("Connect supplier fills to the borrower-facing quote and demo flow.");
  });

  it("guides platform fee work toward borrower flow visibility", () => {
    const platformFee = guidance().find((item) => item.track === "platform_fee");

    expect(platformFee?.currentImplementationStatus).toBe("partial");
    expect(platformFee?.scenarioStatus).toBe("pass");
    expect(platformFee?.roadmapPhase).toBe("borrower quote integration");
    expect(platformFee?.nextBuildStep).toBe("Surface the 1% DCR platform fee clearly in borrower quotes and summaries.");
  });

  it("guides watcher confirmations toward product-visible status", () => {
    const watchers = guidance().find((item) => item.track === "watcher_confirmations");

    expect(watchers?.currentImplementationStatus).toBe("partial");
    expect(watchers?.scenarioStatus).toBe("pass");
    expect(watchers?.roadmapPhase).toBe("watcher-backed confirmation UI");
    expect(watchers?.nextBuildStep).toBe("Expose confirmation status in borrower and supplier views before deeper chain integration.");
  });

  it("guides oracle policy toward UI health messaging", () => {
    const oracle = guidance().find((item) => item.track === "oracle_policy");

    expect(oracle?.currentImplementationStatus).toBe("partial");
    expect(oracle?.scenarioStatus).toBe("warning");
    expect(oracle?.roadmapPhase).toBe("oracle health in UI");
    expect(oracle?.nextBuildStep).toBe("Connect oracle health, freshness, and deviation warnings to borrower and ops screens.");
  });

  it("guides evidence commitments after core product flow", () => {
    const evidence = guidance().find((item) => item.track === "evidence_commitments");

    expect(evidence?.currentImplementationStatus).toBe("partial");
    expect(evidence?.scenarioStatus).toBe("pass");
    expect(evidence?.roadmapPhase).toBe("evidence bundle review");
    expect(evidence?.nextBuildStep).toBe("Add an evidence bundle review surface after borrower and supplier quote flows feel real.");
  });

  it("guides collateral templates after quote and supplier visibility", () => {
    const collateralTemplates = guidance().find((item) => item.track === "collateral_templates");

    expect(collateralTemplates?.currentImplementationStatus).toBe("partial");
    expect(collateralTemplates?.scenarioStatus).toBe("pass");
    expect(collateralTemplates?.roadmapPhase).toBe("collateral template review");
    expect(collateralTemplates?.nextBuildStep).toBe("Add template review only after quote, supplier fill, and fee visibility are wired into the demo flow.");
  });

  it("guides arbiter review after borrower and supplier positions", () => {
    const arbiter = guidance().find((item) => item.track === "arbiter_review");

    expect(arbiter?.currentImplementationStatus).toBe("partial");
    expect(arbiter?.scenarioStatus).toBe("warning");
    expect(arbiter?.roadmapPhase).toBe("arbiter case workflow");
    expect(arbiter?.nextBuildStep).toBe("Defer full arbiter workflow until borrower/supplier positions and repayment allocation are visible.");
  });

  it("keeps fallback liquidation blocked until simnet proof prerequisites", () => {
    const fallback = guidance().find((item) => item.track === "fallback_liquidation");

    expect(fallback?.currentImplementationStatus).toBe("blocked");
    expect(fallback?.scenarioStatus).toBe("blocked");
    expect(fallback?.roadmapPhase).toBe("simnet automatic fallback liquidation");
    expect(fallback?.nextBuildStep).toBe("Wait until oracle, watcher, evidence, arbiter, and collateral-template flows are proven in simnet.");
  });

  it("keeps treasury research behind product proof points", () => {
    const treasury = guidance().find((item) => item.track === "treasury_request_research");

    expect(treasury?.currentImplementationStatus).toBe("not_started");
    expect(treasury?.scenarioStatus).toBe("warning");
    expect(treasury?.roadmapPhase).toBe("ecosystem funding research");
    expect(treasury?.nextBuildStep).toBe("Capture product proof points from borrower/supplier demo flows before drafting request materials.");
  });
});
