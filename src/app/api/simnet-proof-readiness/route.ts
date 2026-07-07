import { NextResponse } from "next/server";
import { listSimnetProofSessions, refreshSimnetProofSession } from "@/lib/simnet-proof-readiness-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await listSimnetProofSessions({
    lookupCode: url.searchParams.get("lookupCode") ?? undefined,
    proofSessionId: url.searchParams.get("proofSessionId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { status: result.status });
}

export async function POST(request: Request) {
  const result = await refreshSimnetProofSession(await request.json());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { status: result.status });
}
