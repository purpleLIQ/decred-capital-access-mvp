import { NextResponse } from "next/server";
import { listArbiterCases, recordArbiterActionDecision } from "@/lib/arbiter-case-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await listArbiterCases({
    caseId: url.searchParams.get("caseId") ?? undefined,
    lookupCode: url.searchParams.get("lookupCode") ?? undefined,
    limit: Number(url.searchParams.get("limit") ?? 25),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { status: result.status });
}

export async function POST(request: Request) {
  const result = await recordArbiterActionDecision(await request.json());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { status: result.status });
}
