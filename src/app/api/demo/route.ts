import { NextResponse } from "next/server";
import { decredAdapter } from "@/lib/adapters/decred-adapter";
import { ticketCollateralNote } from "@/lib/fixtures";
import { listEvents, listLoans } from "@/lib/demo-db";
import { getMarketSnapshot } from "@/lib/price-oracle";
import { classifyRisk } from "@/lib/risk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const [loans, events, market] = await Promise.all([listLoans(), listEvents(), getMarketSnapshot()]);
  const primaryLoan = loans.find((loan) => loan.status !== "released" && loan.status !== "canceled") ?? loans[0];

  return NextResponse.json({
    market,
    loans: loans.map((loan) => ({
      ...loan,
      riskLevel: classifyRisk(loan.currentLtvBps),
      escrowChecklist: decredAdapter.getLoanEscrowChecklist(loan),
    })),
    events,
    escrowPreview: decredAdapter.createDemoEscrow(primaryLoan?.ref ?? "DCR-DEMO"),
    ticketCollateralNote,
    trustModel: [
      "Demo mode never touches mainnet funds or private keys.",
      "The intended mainnet custody model is 2-of-3 Decred multisig.",
      "Price checks and liquidations are operator-reviewed in v1.",
      "Existing DCR ticket proofs are research signals, not secure collateral.",
    ],
  });
}
