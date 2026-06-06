import { NextResponse } from "next/server";
import { z } from "zod";
import { getMarketSnapshot } from "@/lib/price-oracle";
import { buildQuote } from "@/lib/risk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const quoteSchema = z.object({
  collateralDcr: z.coerce.number().positive().max(100000),
  borrowAmount: z.coerce.number().positive().max(1000000),
  borrowAsset: z.enum(["USDC", "USDT", "BTC"]).default("USDC"),
});

export async function POST(request: Request) {
  const body = quoteSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "Enter a positive DCR collateral amount and borrow amount." }, { status: 400 });
  }

  const market = await getMarketSnapshot();
  return NextResponse.json(buildQuote({ ...body.data, market }));
}
