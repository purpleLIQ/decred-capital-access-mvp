import { NextResponse } from "next/server";
import { listHeadlessLifecycleEvents, submitHeadlessLifecycleEvent } from "@/lib/headless-lifecycle-event-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await listHeadlessLifecycleEvents({
    lookupCode: url.searchParams.get("lookupCode") ?? undefined,
    limit: Number(url.searchParams.get("limit") ?? 25),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { status: result.status });
}

export async function POST(request: Request) {
  const result = await submitHeadlessLifecycleEvent(await request.json());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { status: result.status });
}
