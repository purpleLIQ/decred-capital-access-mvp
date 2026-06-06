import { NextResponse } from "next/server";
import { getLoan, updateLoan } from "@/lib/demo-db";
import { formatSchemaError, loanActionSchema } from "@/lib/api-schemas";
import { transitionLoan } from "@/lib/loan-state-machine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const body = loanActionSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: formatSchemaError(body.error) }, { status: 400 });
  }

  const loan = await getLoan(body.data.loanId);
  if (!loan) {
    return NextResponse.json({ error: "Loan not found." }, { status: 404 });
  }

  const transition = transitionLoan(loan, body.data.action);
  return NextResponse.json(await updateLoan(transition.loan, transition.event));
}
