import { describe, expect, it } from "vitest";

import { GET } from "../route";

describe("GET /api/protocol-scenario", () => {
  it("returns the deterministic protocol scenario payload", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.readOnly).toBe(true);
    expect(payload.summary.loanRequestId).toBe("loan-request-fixture-1");
    expect(payload.summary.fundingStatus).toBe("funded");
    expect(payload.summary.activationEligible).toBe(true);
    expect(payload.loanRequest.borrowAsset).toBe("BTC");
    expect(payload.quote.fundingState.status).toBe("funded");
    expect(payload.evidence.record.status).toBe("anchored");
    expect(payload.collateral.observation.status).toBe("confirmed");
    expect(payload.disbursementObservations[0].status).toBe("confirmed");
  });

  it("includes the operator-readable review report", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(payload.report.id).toBe("scenario-report:loan-request-fixture-1");
    expect(payload.report.overallStatus).toBe("pass");
    expect(payload.report.sections).toHaveLength(3);
    expect(payload.report.notes).toContain("Report generation is read-only.");
  });

  it("includes roadmap guidance for the next product build steps", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(payload.roadmapGuidance).toHaveLength(9);
    expect(payload.roadmapGuidance.find((item: { track: string }) => item.track === "supplier_funding")?.nextBuildStep).toBe(
      "Connect supplier fills to the borrower-facing quote and demo flow.",
    );
    expect(payload.roadmapGuidance.find((item: { track: string }) => item.track === "platform_fee")?.roadmapPhase).toBe("borrower quote integration");
    expect(payload.roadmapGuidance.find((item: { track: string }) => item.track === "fallback_liquidation")?.currentImplementationStatus).toBe("blocked");
  });

  it("includes explicit read-only notes", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(payload.notes).toContain("Deterministic protocol fixture endpoint.");
    expect(payload.notes).toContain("No mutation or execution path is provided.");
  });
});
