# Liquidation Automation Plan

Production should not rely on a person remembering to liquidate risky loans. The current app still uses demo/operator review, but the design should move toward guarded automation that evaluates risk, queues reviews, alerts operators, and circuit-breaks unsafe conditions.

Automation must not mean app-side liquidation execution.

## Goal

Automated liquidation should protect lenders when DCR collateral falls below required coverage, without creating unsafe forced sales during bad oracle states, thin DEX liquidity, missing borrower warning periods, or incomplete transaction-review gates.

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
   - Automation may queue urgent review only if oracle and liquidity guardrails pass.

## Automation Guardrails

Automated liquidation should require:

- healthy oracle state,
- enough independent price sources,
- acceptable source divergence,
- enough DEX or exchange depth,
- slippage below the configured max,
- grace period elapsed unless an explicitly documented emergency policy applies,
- unsigned transaction review generated,
- required approvals tracked,
- signing path separated from server custody,
- broadcast review separated from signing collection,
- operator alerts and audit trail.

## Current Implementation

The current code includes a liquidation policy model. It does not liquidate anything.

The policy can return:

- `none`
- `warn`
- `queue_review`
- `auto_liquidate`

`auto_liquidate` is only a policy decision. It may indicate that the hard threshold is crossed and guardrails pass, but it must still queue a transaction review and cannot sign or broadcast from the server.

Current related groundwork:

- liquidation policy blockers can be copied into transaction review,
- liquidation transaction reviews require lender, arbiter, and operator approvals,
- simnet unsigned-builder scaffold exists for liquidation previews,
- signing sessions can collect external signed hex once a review is ready,
- broadcast review remains manual/review-only and keeps `canBroadcast: false`.

## Not Implemented Yet

- Persistent liquidation watcher job.
- Borrower notification delivery.
- Exchange/DEX depth estimation tied to liquidation execution.
- Real simnet liquidation proof.
- Real Decred signature verification.
- Broadcast adapter.
- Production liquidation execution.

## Next Implementation Steps

1. Persist warning timestamps on loans or events.
2. Add a liquidation watcher job that evaluates open loans.
3. Add exchange/DEX depth estimation.
4. Queue liquidation transaction review records automatically.
5. Build unsigned liquidation transaction previews on simnet.
6. Use non-custodial signing sessions for required roles.
7. Send completed sessions through broadcast review while keeping `canBroadcast: false`.
8. Add production alerting for failed automation or degraded oracle state.

## Production Rule

Automation may evaluate, warn, queue, prepare, alert, retry, and circuit-break. Signing must stay outside server custody. Broadcast must remain disabled until simnet/testnet proof, explicit operator review, legal review, and security review support a limited path.

Do not describe liquidation automation as production-ready until it has been proven with real simnet/testnet evidence and reviewed operational controls.
