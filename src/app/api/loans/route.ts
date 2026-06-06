import { NextResponse } from "next/server";
import { createLoan, listLoans } from "@/lib/demo-db";
import { formatSchemaError, loanInputSchema } from "@/lib/api-schemas";
import { getMarketSnapshot } from "@/lib/price-oracle";
import { buildQuote } from "@/lib/risk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({ loans: await listLoans() });
}

export async function POST(request: Request) {
  const body = loanInputSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: formatSchemaError(body.error) }, { status: 400 });
  }

  const market = await getMarketSnapshot();
  const quote = buildQuote({ ...body.data, market });
  const loan = await createLoan({ ...body.data, quote });
  return NextResponse.json({ loan }, { status: 201 });
}
