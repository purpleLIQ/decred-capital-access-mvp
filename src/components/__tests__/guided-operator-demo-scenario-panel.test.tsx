import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createHeadlessLoanLifecycleRecord } from "@/lib/headless-loan-lifecycle";
import { GuidedOperatorDemoScenarioPanel } from "../guided-operator-demo-scenario-panel";

describe("GuidedOperatorDemoScenarioPanel", () => {
  it("renders the guided scenario shell with safety boundaries", () => {
    const record = createHeadlessLoanLifecycleRecord({
      collateralDcr: 120,
      borrowAmount: 1000,
      borrowAsset: "USDC",
      borrowerAcceptedQuote: true,
      borrowerAcceptedPartialFunding: true,
      now: "2026-07-08T13:45:00.000Z",
    });
    const markup = renderToStaticMarkup(<GuidedOperatorDemoScenarioPanel record={record} onRecordUpdated={() => undefined} />);

    expect(markup).toContain("Guided demo scenario");
    expect(markup).toContain("Run next");
    expect(markup).toContain("Run selected preset");
    expect(markup).toContain("Run repayment preset");
    expect(markup).toContain("Repayment");
    expect(markup).toContain("Release readiness");
    expect(markup).toContain("Proof readiness");
    expect(markup).toContain("Phase");
    expect(markup).toContain("Proof session");
    expect(markup).toContain("Broadcast blocked");
    expect(markup).toContain("No signing, no broadcast, no real funds");
  });
});
