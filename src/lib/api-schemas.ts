import { z } from "zod";

export const borrowAssetSchema = z.enum(["USDC", "USDT", "BTC"]);
export const transactionPurposeSchema = z.enum(["collateral_deposit", "loan_payout", "collateral_release", "liquidation"]);

export const loanInputSchema = z.object({
  collateralDcr: z.coerce.number().positive().max(100000),
  borrowAmount: z.coerce.number().positive().max(1000000),
  borrowAsset: borrowAssetSchema.default("USDC"),
});

export const loanActionSchema = z.object({
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

export const transactionReviewSchema = z.object({
  loanId: z.string().min(1),
  purpose: transactionPurposeSchema,
});

export function formatSchemaError(error: z.ZodError): string {
  const firstIssue = error.issues[0];
  if (!firstIssue) return "Invalid request.";
  const field = firstIssue.path.join(".");
  return field ? `${field}: ${firstIssue.message}` : firstIssue.message;
}
