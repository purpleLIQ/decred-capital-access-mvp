import { NextResponse } from "next/server";
import { handleAddSigningSubmission } from "@/lib/signing-session-api-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const result = handleAddSigningSubmission(await request.json());
  return NextResponse.json(result.body, { status: result.status });
}
