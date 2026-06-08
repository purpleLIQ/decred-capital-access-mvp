import { NextResponse } from "next/server";
import { handleCreateSigningSession, handleListSigningSessions } from "@/lib/signing-session-api-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const result = handleListSigningSessions();
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: Request) {
  const result = handleCreateSigningSession(await request.json());
  return NextResponse.json(result.body, { status: result.status });
}
