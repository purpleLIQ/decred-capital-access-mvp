import { NextResponse } from "next/server";
import { getSystemHealth } from "@/lib/system-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const health = await getSystemHealth();
  return NextResponse.json(health, { status: health.status === "ok" ? 200 : 503 });
}
