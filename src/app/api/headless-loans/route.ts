import { NextResponse } from "next/server";
import {
  createAndSaveHeadlessLifecycle,
  listRecentHeadlessLifecycles,
  lookupHeadlessLifecycle,
} from "@/lib/headless-lifecycle-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lookupCode = url.searchParams.get("lookupCode");
  const limit = Number(url.searchParams.get("limit") ?? 10);
  const result = lookupCode
    ? await lookupHeadlessLifecycle({ lookupCode })
    : await listRecentHeadlessLifecycles(Number.isFinite(limit) ? limit : 10);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { status: result.status });
}

export async function POST(request: Request) {
  const result = await createAndSaveHeadlessLifecycle(await request.json());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { status: result.status });
}
