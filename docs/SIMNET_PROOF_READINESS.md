# Simnet Proof Readiness

This scaffold gives operators a review-only view of whether a lifecycle record is ready for a future simnet collateral-release proof flow.

It does not create transactions, request signatures, accept signed hex for broadcast, call Decred RPC, unlock wallets, broadcast, release collateral, liquidate, or move funds.

## Flow

```text
lifecycle record
-> watcher/evidence/review status
-> simnet proof session
-> proof readiness checklist
-> unsigned release preview placeholder
-> signing session placeholder
-> external signed-hex placeholder
-> verification placeholder
-> broadcast review remains blocked
```

## Readiness Inputs

`deriveSimnetProofReadiness(...)` inspects:

- collateral lock status,
- DCR platform fee output status,
- evidence bundle and timestamp status,
- arbiter/manual review status,
- repayment or collateral-release readiness,
- recent lifecycle events that indicate watcher or integrity-review blockers,
- unresolved arbiter review cases.

The helper is pure. It does not mutate lifecycle records or write sessions.

## Session Refresh

`refreshSimnetProofSession(...)` loads the existing lifecycle record, recent lifecycle events, and review cases, then stores a deterministic session in the local simnet proof session store.

The ops UI exposes this as an operator-only `Seed/refresh proof session` action. It is safe to use in demo mode because it only refreshes review metadata.

## Safety Rules

- Broadcast is always blocked.
- Signing is always blocked.
- Signed-hex submission is always blocked.
- Signature verification is a placeholder and cannot enable broadcast.
- Mainnet, wallet unlock, private keys, seed phrases, signing, broadcast, collateral release execution, liquidation execution, and real fund movement are out of scope.

## Next Useful Step

After this PR is reviewed, the next milestone should be a separate simnet proof design pass that defines unsigned transaction preview data structures and verification expectations without enabling execution.
