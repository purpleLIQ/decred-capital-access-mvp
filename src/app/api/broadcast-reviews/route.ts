import { NextResponse } from "next/server";
import { handleCreateBroadcastReview, handleListBroadcastReviews } from "@/lib/broadcast-review-api-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const result = handleListBroadcastReviews();
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: Request) {
  const result = handleCreateBroadcastReview(await request.json());
  return NextResponse.json(result.body, { status: result.status });
}
