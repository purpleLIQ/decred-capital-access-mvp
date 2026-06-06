import { NextResponse } from "next/server";
import { getMarketSnapshot } from "@/lib/price-oracle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(await getMarketSnapshot());
}
