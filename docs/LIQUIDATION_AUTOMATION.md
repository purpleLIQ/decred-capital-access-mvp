# Liquidation Automation Plan

Production should not rely on manual liquidation. The app still needs operator review in the demo, but the production design should move toward guarded automation.

## Goal

Automated liquidation should protect lenders when DCR collateral falls below required coverage, without creating unsafe forced sales during bad oracle states or thin DEX liquidity.

## Policy Layers

1. **Warning threshold**
   - Loan crosses warning LTV.
   - Borrower gets notified.
   - App records a grace-period start time.

2. **Liquidation threshold**
   - Loan crosses liquidation LTV.
   - App queues liquidation review.
   - Automation remains blocked unless all safety checks pass.

3. **Hard liquidation threshold**
   - Loan crosses hard liquidation LTV.
   - Automation may run only if oracle and liquidity guardrails pass.

## Automation Guardrails

Automated liquidation should require:

- healthy oracle state
- enough independent price sources
- acceptable source divergence
- enough DEX or exchange depth
- slippage below the configured max
- grace period elapsed
- unsigned transaction review generated
- signing path separated from server custody

## Current Implementation

The current code adds a liquidation policy model. It does not liquidate anything yet.

The policy can return:

- `none`
- `warn`
- `queue_review`
- `auto_liquidate`

`auto_liquidate` is only allowed when the hard threshold is crossed and all guardrails pass.

## Next Implementation Steps

1. Persist warning timestamps on loans or events.
2. Add a liquidation watcher job that evaluates open loans.
3. Add exchange/DEX depth estimation.
4. Build unsigned liquidation transaction previews on simnet.
5. Add transaction review UI.
6. Add non-custodial signing flow.
7. Add production alerting for failed automation or degraded oracle state.

## Production Rule

Automation may decide and prepare. Signing must stay outside server custody unless a future legal and security review explicitly approves a different model.
