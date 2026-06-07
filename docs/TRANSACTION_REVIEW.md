# Transaction Review Layer

Transaction review is the safety layer between "the app wants to move money" and "someone signs a transaction."

The current branch implements review envelopes and simnet unsigned-builder scaffolding only. It does not sign, broadcast, store private keys, or execute liquidation.

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
- Guarded simnet wallet RPC client for unsigned-only methods.
- RPC-backed builder scaffold for creating unsigned release/liquidation previews from confirmed simnet escrow UTXOs.

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
| `collateral_release` | borrower, lender, operator | blocked preview; simnet unsigned builder scaffold exists |
| `liquidation` | lender, arbiter, operator | blocked preview plus liquidation-policy gates; simnet unsigned builder scaffold exists |

## Simnet Unsigned Builder Seam

`src/lib/adapters/simnet-unsigned-builder.ts` defines the handoff point for builder implementations.

Current default behavior:

- the default builder is blocked,
- no signing is performed,
- no broadcast function exists,
- injected test builders can produce unsigned preview objects for release/liquidation only.

## RPC-Backed Builder Scaffold

`src/lib/adapters/simnet-wallet-rpc-client.ts` and `src/lib/adapters/simnet-rpc-unsigned-builder.ts` add the first RPC-backed scaffold.

The scaffold may:

- call `listunspent` for a configured simnet wallet role,
- filter confirmed escrow UTXOs,
- call `createrawtransaction`,
- return unsigned raw transaction hex and preview metadata.

The scaffold must not call:

- `signrawtransaction`,
- `sendrawtransaction`,
- wallet unlock methods,
- private-key import/export methods.

Signing and broadcast stay outside the app-owned server process.

## Liquidation Review

Liquidation review includes the liquidation automation policy decision. The policy can decide `warn`, `queue_review`, or `auto_liquidate`, but it still does not sign or broadcast. When oracle health, DEX depth, or grace-period checks fail, blockers are copied into the transaction review envelope.

## Current Blockers

- Demo adapter is not connected to dcrd or dcrwallet.
- Default simnet builder is blocked.
- RPC-backed builder has not been proven against a running simnet.
- No wallet-side or client-side signing path exists.
- No broadcast path exists.

## Next Implementation Step

Run the RPC-backed unsigned builder against isolated simnet wallets and capture proof artifacts. It should output unsigned raw transaction previews only. Signing must remain outside the app-owned server process.
