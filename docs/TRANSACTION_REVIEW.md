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

## Signing Readiness Rule

A review can move to signing only when all of these are true:

1. Review status is `ready_for_signing`.
2. Blockers are empty.
3. Every required approval role is true.
4. An unsigned transaction preview exists with raw transaction hex.
5. Server signing, server broadcast, and server private-key storage remain disabled.

Demo and current simnet reviews intentionally fail this rule.

## Purpose Rules

| Purpose | Required approvals | Current status |
| --- | --- | --- |
| `collateral_deposit` | borrower, operator | blocked preview |
| `loan_payout` | lender, operator | blocked preview |
| `collateral_release` | borrower, lender, operator | blocked preview |
| `liquidation` | lender, arbiter, operator | blocked preview plus liquidation-policy gates |

## Liquidation Review

Liquidation review includes the liquidation automation policy decision. The policy can decide `warn`, `queue_review`, or `auto_liquidate`, but it still does not sign or broadcast. When oracle health, DEX depth, or grace-period checks fail, blockers are copied into the transaction review envelope.

## Current Blockers

- Demo adapter is not connected to dcrd or dcrwallet.
- Simnet wallet RPC configuration is not wired.
- Unsigned transaction builder is not implemented.
- No wallet-side or client-side signing path exists.
- No broadcast path exists.

## Next Implementation Step

Implement a simnet-only unsigned transaction builder. It should output an unsigned raw transaction preview, never a signed transaction. Signing must remain outside the app-owned server process.
