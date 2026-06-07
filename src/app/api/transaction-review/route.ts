import { NextResponse } from "next/server";
import { transactionReviewRequestSchema, formatSchemaError } from "@/lib/api-schemas";
import { getLoan } from "@/lib/demo-db";
import { getMarketSnapshot } from "@/lib/price-oracle";
import { canMoveToSigning, createTransactionReviewEnvelope } from "@/lib/transaction-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const body = transactionReviewRequestSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: formatSchemaError(body.error) }, { status: 400 });
  }

  const loan = await getLoan(body.data.loanId);
  if (!loan) {
    return NextResponse.json({ error: "Loan not found." }, { status: 404 });
  }

  const market = await getMarketSnapshot();
  const review = createTransactionReviewEnvelope({
    loan,
    purpose: body.data.purpose,
    network: body.data.network,
    approvals: body.data.approvals,
    market,
  });

  return NextResponse.json({
    review,
    canMoveToSigning: canMoveToSigning(review),
  });
}
