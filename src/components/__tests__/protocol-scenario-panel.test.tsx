import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProtocolScenarioPanel, type DemoProtocolScenario } from "../protocol-scenario-panel";

const scenario: DemoProtocolScenario = {
  loanRequestId: "loan-request-fixture-1",
  borrowAsset: "BTC",
  collateralAsset: "DCR",
  fundingStatus: "funded",
  activationEligible: true,
  supplierCount: 1,
  collateralTemplateStatus: "ready_for_unsigned_preview",
  collateralObservationStatus: "confirmed",
  disbursementObservationStatuses: ["confirmed"],
  evidenceRecordStatus: "anchored",
  evidenceCommitmentHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  platformFeeAmount: 0.7,
  arbiterReserveAmount: 0.3,
  notes: ["Read-only protocol scenario fixture."],
};

describe("ProtocolScenarioPanel", () => {
  it("renders the funded protocol scenario summary", () => {
    const markup = renderToStaticMarkup(<ProtocolScenarioPanel scenario={scenario} />);

    expect(markup).toContain("protocol://fixture/loan-request-fixture-1");
    expect(markup).toContain("funded");
    expect(markup).toContain("confirmed");
    expect(markup).toContain("anchored");
    expect(markup).toContain("01234567...abcdef");
    expect(markup).toContain("Read-only protocol scenario fixture.");
  });

  it("renders nothing when scenario is unavailable", () => {
    const markup = renderToStaticMarkup(<ProtocolScenarioPanel />);

    expect(markup).toBe("");
  });
});
