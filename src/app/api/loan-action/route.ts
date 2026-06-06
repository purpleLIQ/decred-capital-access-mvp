import { NextResponse } from "next/server";
import { z } from "zod";
import { getLoan, updateLoan } from "@/lib/demo-db";
import { transitionLoan } from "@/lib/loan-state-machine";
import type { LoanAction } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const actionSchema = z.object({
  loanId: z.string().min(1),
  action: z.enum([
    "simulate_collateral",
    "approve_and_fund",
    "simulate_repayment",
    "release_collateral",
    "mark_margin_warning",
    "start_liquidation_review",
    "mark_defaulted",
    "complete_liquidation",
    "cancel",
  ]),
});

export async function POST(request: Request) {
  const body = actionSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json({ error: "Choose a valid demo loan action." }, { status: 400 });
  }

  const loan = await getLoan(body.data.loanId);
  if (!loan) {
    return NextResponse.json({ error: "Loan not found." }, { status: 404 });
  }

  const transition = transitionLoan(loan, body.data.action as LoanAction);
  return NextResponse.json(await updateLoan(transition.loan, transition.event));
}
