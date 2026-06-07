import { NextResponse } from "next/server";
import { formatSchemaError, transactionReviewSchema } from "@/lib/api-schemas";
import { buildTransactionReviewEnvelope } from "@/lib/transaction-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const body = transactionReviewSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: formatSchemaError(body.error) }, { status: 400 });
  }

  const envelope = await buildTransactionReviewEnvelope(body.data);
  if (!envelope) {
    return NextResponse.json({ error: "Loan not found." }, { status: 404 });
  }

  return NextResponse.json(envelope);
}
