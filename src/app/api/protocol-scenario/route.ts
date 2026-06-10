import { NextResponse } from "next/server";
import { getDemoProtocolScenario } from "../../../lib/demo-scenario-adapter";
import { createProtocolFixtureScenario } from "../../../lib/protocol/protocol-fixtures";
import { createScenarioReviewReport } from "../../../lib/scenario-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const scenario = createProtocolFixtureScenario();
  const generatedAt = "2026-06-10T12:10:00.000Z";

  return NextResponse.json({
    summary: getDemoProtocolScenario(),
    report: createScenarioReviewReport({ scenario, generatedAt }),
    loanRequest: scenario.loanRequest,
    quote: scenario.quote,
    evidence: {
      bundle: scenario.evidenceBundle,
      commitment: scenario.evidenceCommitment,
      record: scenario.evidenceRecord,
    },
    collateral: {
      template: scenario.collateralTemplate,
      observation: scenario.collateralObservation,
    },
    disbursementObservations: scenario.disbursementObservations,
    readOnly: true,
    notes: [
      "Deterministic protocol fixture endpoint.",
      "This endpoint exposes scenario state only.",
      "No mutation or execution path is provided.",
    ],
  });
}
