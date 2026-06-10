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

  it("includes explicit read-only notes", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(payload.notes).toContain("Deterministic protocol fixture endpoint.");
    expect(payload.notes).toContain("No mutation or execution path is provided.");
  });
});
