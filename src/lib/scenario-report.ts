import type { ProtocolFixtureScenario } from "./protocol/protocol-fixtures";

export type ScenarioReportCheckStatus = "pass" | "review" | "blocked";

export interface ScenarioReportCheck {
  id: string;
  label: string;
  status: ScenarioReportCheckStatus;
  detail: string;
}

export interface ScenarioReportSection {
  id: string;
  title: string;
  checks: ScenarioReportCheck[];
}

export interface ScenarioReviewReport {
  id: string;
  loanRequestId: string;
  generatedAt: string;
  overallStatus: ScenarioReportCheckStatus;
  sections: ScenarioReportSection[];
  notes: string[];
}

export function createScenarioReviewReport(input: {
  scenario: ProtocolFixtureScenario;
  generatedAt: string;
}): ScenarioReviewReport {
  const sections: ScenarioReportSection[] = [
    {
      id: "funding",
      title: "Funding and quote",
      checks: [
        {
          id: "funding-state",
          label: "Funding state",
          status: input.scenario.quote.fundingState.status === "funded" ? "pass" : "review",
          detail: input.scenario.quote.fundingState.status,
        },
        {
          id: "activation-eligible",
          label: "Activation eligibility",
          status: input.scenario.quote.activationEligible ? "pass" : "review",
          detail: input.scenario.quote.activationEligible ? "Eligible" : "Waiting for prerequisite state",
        },
        {
          id: "supplier-count",
          label: "Supplier count",
          status: input.scenario.fills.length > 0 ? "pass" : "review",
          detail: `${input.scenario.fills.length} supplier fill(s)`,
        },
      ],
    },
    {
      id: "collateral",
      title: "Collateral and watchers",
      checks: [
        {
          id: "collateral-template",
          label: "Collateral template",
          status: input.scenario.collateralTemplate.status === "ready_for_unsigned_preview" ? "pass" : "blocked",
          detail: input.scenario.collateralTemplate.status.replaceAll("_", " "),
        },
        {
          id: "collateral-observation",
          label: "Collateral observation",
          status: input.scenario.collateralObservation.status === "confirmed" ? "pass" : "review",
          detail: input.scenario.collateralObservation.status,
        },
        {
          id: "disbursement-observations",
          label: "Disbursement observations",
          status: input.scenario.disbursementObservations.every((observation) => observation.status === "confirmed") ? "pass" : "review",
          detail: input.scenario.disbursementObservations.map((observation) => observation.status).join(", "),
        },
      ],
    },
    {
      id: "evidence",
      title: "Evidence record",
      checks: [
        {
          id: "evidence-record",
          label: "Evidence record",
          status: input.scenario.evidenceRecord.status === "anchored" ? "pass" : "review",
          detail: input.scenario.evidenceRecord.status,
        },
        {
          id: "evidence-hash",
          label: "Evidence commitment",
          status: /^[a-f0-9]{64}$/.test(input.scenario.evidenceCommitment.commitmentHash) ? "pass" : "blocked",
          detail: shortHash(input.scenario.evidenceCommitment.commitmentHash),
        },
      ],
    },
  ];

  return {
    id: `scenario-report:${input.scenario.loanRequest.id}`,
    loanRequestId: input.scenario.loanRequest.id,
    generatedAt: input.generatedAt,
    overallStatus: summarizeOverallStatus(sections),
    sections,
    notes: [
      "Deterministic scenario review report.",
      "Operator-readable checklist for demo and ops inspection.",
      "Report generation is read-only.",
    ],
  };
}

function summarizeOverallStatus(sections: ScenarioReportSection[]): ScenarioReportCheckStatus {
  const checks = sections.flatMap((section) => section.checks);

  if (checks.some((check) => check.status === "blocked")) {
    return "blocked";
  }

  if (checks.some((check) => check.status === "review")) {
    return "review";
  }

  return "pass";
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}
