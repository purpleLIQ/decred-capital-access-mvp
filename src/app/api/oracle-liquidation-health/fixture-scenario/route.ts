import { NextResponse } from "next/server";
import { submitOperatorFixtureLiquidationHealthScenario } from "@/lib/oracle-liquidation-health-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const result = await submitOperatorFixtureLiquidationHealthScenario(await request.json());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { status: result.status });
}
