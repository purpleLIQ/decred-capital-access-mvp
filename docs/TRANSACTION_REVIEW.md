# Transaction Review Layer

Transaction review is the safety layer between "the app wants to move money" and "someone signs a transaction."

The current branch implements review envelopes only. It does not sign, broadcast, store private keys, or build real Decred raw transactions.

## What Exists

- `src/lib/transaction-review.ts`
- `POST /api/transaction-review`
- Console tab: `Tx review`
- Purpose mapping for:
  - collateral deposit
  - loan payout
  - collateral release
  - liquidation
- Approval state for:
  - borrower
  - lender
  - arbiter
  - operator
- `canMoveToSigning(review)` guard.
- Simnet unsigned-builder seam for release and liquidation previews.

## Signing Readiness Rule

A review can move to signing only when all of these are true:

1. Review status is `ready_for_signing`.
2. Blockers are empty.
3. Every required approval role is true.
4. An unsigned transaction preview exists with raw transaction hex.
5. Server signing, server broadcast, and server private-key storage remain disabled.

Demo and default simnet reviews intentionally fail this rule.

## Purpose Rules

| Purpose | Required approvals | Current status |
| --- | --- | --- |
| `collateral_deposit` | borrower, operator | blocked preview |
| `loan_payout` | lender, operator | blocked preview |
| `collateral_release` | borrower, lender, operator | blocked preview; builder seam exists for simnet |
| `liquidation` | lender, arbiter, operator | blocked preview plus liquidation-policy gates; builder seam exists for simnet |

## Simnet Unsigned Builder Seam

`src/lib/adapters/simnet-unsigned-builder.ts` defines the handoff point for future RPC-backed builders.

Current behavior:

- the default builder is blocked,
- no RPC calls are made,
- no signing is performed,
- no broadcast function exists,
- injected test builders can produce unsigned preview objects for release/liquidation only.

A real simnet RPC builder still needs to call isolated local wallet tooling to produce unsigned raw transaction hex, then return a review preview with exact inputs, outputs, fees, redeem script metadata, blockers, and warnings.

## Liquidation Review

Liquidation review includes the liquidation automation policy decision. The policy can decide `warn`, `queue_review`, or `auto_liquidate`, but it still does not sign or broadcast. When oracle health, DEX depth, or grace-period checks fail, blockers are copied into the transaction review envelope.

## Current Blockers

- Demo adapter is not connected to dcrd or dcrwallet.
- Default simnet builder is blocked.
- No real wallet RPC builder is implemented.
- No wallet-side or client-side signing path exists.
- No broadcast path exists.

## Next Implementation Step

Implement a real simnet-only RPC unsigned transaction builder. It should output an unsigned raw transaction preview, never a signed transaction. Signing must remain outside the app-owned server process.
