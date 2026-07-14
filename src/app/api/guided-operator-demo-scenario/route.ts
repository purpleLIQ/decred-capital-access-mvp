import { NextResponse } from "next/server";
import { readGuidedOperatorDemoScenario, runGuidedOperatorDemoAction } from "@/lib/guided-operator-demo-scenario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lookupCode = url.searchParams.get("lookupCode");
  if (!lookupCode) return NextResponse.json({ error: "lookupCode is required." }, { status: 400 });
  const result = await readGuidedOperatorDemoScenario({
    lookupCode,
    scenarioType: url.searchParams.get("scenarioType") ?? undefined,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { status: result.status });
}

export async function POST(request: Request) {
  const result = await runGuidedOperatorDemoAction(await request.json());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { status: result.status });
}
