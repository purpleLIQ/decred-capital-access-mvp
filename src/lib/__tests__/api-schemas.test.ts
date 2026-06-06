import { describe, expect, it } from "vitest";
import { formatSchemaError, loanActionSchema, loanInputSchema } from "../api-schemas";

describe("API request schemas", () => {
  it("coerces valid loan inputs and defaults to USDC", () => {
    const parsed = loanInputSchema.parse({
      collateralDcr: "100",
      borrowAmount: "350",
    });

    expect(parsed).toEqual({
      collateralDcr: 100,
      borrowAmount: 350,
      borrowAsset: "USDC",
    });
  });

  it("rejects invalid loan inputs with a useful field message", () => {
    const parsed = loanInputSchema.safeParse({ collateralDcr: -1, borrowAmount: 0, borrowAsset: "DOGE" });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(formatSchemaError(parsed.error)).toMatch(/collateralDcr|borrowAmount|borrowAsset/);
    }
  });

  it("accepts known loan actions and rejects unknown actions", () => {
    expect(loanActionSchema.safeParse({ loanId: "loan_123", action: "simulate_repayment" }).success).toBe(true);
    expect(loanActionSchema.safeParse({ loanId: "loan_123", action: "steal_collateral" }).success).toBe(false);
  });
});
