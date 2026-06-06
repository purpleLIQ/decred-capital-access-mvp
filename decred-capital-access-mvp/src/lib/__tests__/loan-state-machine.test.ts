import { describe, expect, it } from "vitest";
import { demoLoans } from "../fixtures";
import { canTransition, transitionLoan } from "../loan-state-machine";

describe("loan state machine", () => {
  it("allows the happy path from collateral confirmation to active loan", () => {
    expect(canTransition("awaiting_collateral", "collateral_confirmed")).toBe(true);
    expect(canTransition("collateral_confirmed", "active")).toBe(true);
    expect(canTransition("collateral_confirmed", "approved")).toBe(true);
    expect(canTransition("approved", "funded")).toBe(true);
    expect(canTransition("funded", "active")).toBe(true);
  });

  it("blocks invalid jumps", () => {
    expect(canTransition("awaiting_collateral", "released")).toBe(false);
    expect(canTransition("released", "active")).toBe(false);
  });

  it("records demo collateral without touching mainnet", () => {
    const pending = demoLoans.find((loan) => loan.id === "loan_demo_pending");
    if (!pending) throw new Error("Missing pending fixture");

    const result = transitionLoan(pending, "simulate_collateral");
    expect(result.loan.status).toBe("collateral_confirmed");
    expect(result.loan.depositTxid).toContain("dcr-demo-deposit");
    expect(result.event.actor).toBe("system");
  });
});
