import { NextResponse } from "next/server";
import { updateHeadlessLifecycleBorrowerContact } from "@/lib/headless-lifecycle-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const result = await updateHeadlessLifecycleBorrowerContact(await request.json());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data, { status: result.status });
}
