import { NextResponse } from "next/server";
import { getDemoProtocolScenario } from "@/lib/demo-scenario-adapter";
import { createProtocolFixtureScenario } from "@/lib/protocol/protocol-fixtures";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const scenario = createProtocolFixtureScenario();

  return NextResponse.json({
    summary: getDemoProtocolScenario(),
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
