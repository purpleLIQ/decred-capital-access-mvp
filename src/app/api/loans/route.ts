import { NextResponse } from "next/server";
import { z } from "zod";
import { createLoan, listLoans } from "@/lib/demo-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const loanSchema = z.object({
  collateralDcr: z.coerce.number().positive().max(100000),
  borrowAmount: z.coerce.number().positive().max(1000000),
  borrowAsset: z.enum(["USDC", "USDT", "BTC"]).default("USDC"),
});

export async function GET() {
  return NextResponse.json({ loans: await listLoans() });
}

export async function POST(request: Request) {
  const body = loanSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "Loan creation needs positive collateral and borrow amounts." }, { status: 400 });
  }

  const loan = await createLoan(body.data);
  return NextResponse.json({ loan }, { status: 201 });
}
