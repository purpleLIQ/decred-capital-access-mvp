import { describe, expect, it } from "vitest";

import { createProtocolFixtureScenario } from "../protocol/protocol-fixtures";
import { createScenarioReviewReport } from "../scenario-report";

describe("scenario report builder", () => {
  it("builds a passing report for the deterministic fixture", () => {
    const scenario = createProtocolFixtureScenario();
    const report = createScenarioReviewReport({
      scenario,
      generatedAt: "2026-06-10T12:10:00.000Z",
    });

    expect(report.id).toBe("scenario-report:loan-request-fixture-1");
    expect(report.overallStatus).toBe("pass");
    expect(report.sections).toHaveLength(3);
    expect(report.sections.flatMap((section) => section.checks).every((check) => check.status === "pass")).toBe(true);
    expect(report.notes).toContain("Report generation is read-only.");
  });

  it("marks a report for review when activation is unavailable", () => {
    const scenario = createProtocolFixtureScenario();
    const report = createScenarioReviewReport({
      scenario: {
        ...scenario,
        quote: {
          ...scenario.quote,
          activationEligible: false,
        },
      },
      generatedAt: "2026-06-10T12:10:00.000Z",
    });

    expect(report.overallStatus).toBe("review");
    expect(report.sections[0].checks.find((check) => check.id === "activation-eligible")?.status).toBe("review");
  });
});
