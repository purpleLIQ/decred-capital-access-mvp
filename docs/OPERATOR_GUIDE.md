# Operator Guide

The operator role exists because v1 is trust-minimized, not fully automated.

## Responsibilities

- Confirm DCR collateral deposits.
- Confirm USDC payouts.
- Monitor LTV and price-source health.
- Decide when a loan needs margin warning or liquidation review.
- Coordinate borrower/lender/arbiter signatures.
- Keep audit logs current.

## Demo Actions

- Detect collateral: simulates a DCR deposit reaching the required confirmation threshold.
- Approve/fund: simulates operator approval and USDC payout.
- Margin warning: moves a loan into borrower attention.
- Liquidation review: moves a loan into manual review.
- Default: marks a missed-remediation loan as defaulted.
- Complete liquidation: simulates liquidation progress.

## Production Requirements

- Separate signing devices.
- Written liquidation policy.
- Emergency pause process.
- Confirmed legal/compliance posture.
- Conservative loan caps.
