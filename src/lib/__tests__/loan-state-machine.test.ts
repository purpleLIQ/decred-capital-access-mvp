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

  it("walks the happy path from collateral to release", () => {
    const pending = demoLoans.find((loan) => loan.id === "loan_demo_pending");
    if (!pending) throw new Error("Missing pending fixture");

    const collateral = transitionLoan(pending, "simulate_collateral").loan;
    const active = transitionLoan(collateral, "approve_and_fund").loan;
    const repaymentPending = transitionLoan(active, "simulate_repayment").loan;
    const repaid = transitionLoan(repaymentPending, "simulate_repayment").loan;
    const releasePending = transitionLoan(repaid, "release_collateral").loan;
    const released = transitionLoan(releasePending, "release_collateral").loan;

    expect(active.status).toBe("active");
    expect(active.payoutTxid).toContain("base-sepolia-usdc");
    expect(repaymentPending.status).toBe("repayment_pending");
    expect(repaid.status).toBe("repaid");
    expect(repaid.repaymentTxid).toContain("base-sepolia-repay");
    expect(releasePending.status).toBe("release_pending");
    expect(released.status).toBe("released");
  });

  it("covers liquidation review, default, liquidating, and liquidated path", () => {
    const active = demoLoans.find((loan) => loan.id === "loan_demo_active");
    if (!active) throw new Error("Missing active fixture");

    const review = transitionLoan(active, "start_liquidation_review").loan;
    const defaulted = transitionLoan(review, "mark_defaulted").loan;
    const liquidating = transitionLoan(defaulted, "complete_liquidation").loan;
    const liquidated = transitionLoan(liquidating, "complete_liquidation").loan;

    expect(review.status).toBe("liquidation_review");
    expect(defaulted.status).toBe("defaulted");
    expect(liquidating.status).toBe("liquidating");
    expect(liquidated.status).toBe("liquidated");
  });

  it("allows cancellation before funding but not after release", () => {
    const pending = demoLoans.find((loan) => loan.id === "loan_demo_pending");
    if (!pending) throw new Error("Missing pending fixture");

    expect(transitionLoan(pending, "cancel").loan.status).toBe("canceled");
    expect(transitionLoan({ ...pending, status: "released" }, "cancel").loan.status).toBe("released");
  });
});
