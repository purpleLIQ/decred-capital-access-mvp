# Transaction Review Layer

Transaction review is the safety layer between “the app wants to move money” and “someone signs a transaction.”

The current app implements review envelopes, unsigned transaction preview scaffolding, signing-session handoff rules, and a later broadcast-review gate. It does not sign, broadcast, store private keys, unlock wallets, or execute liquidation.

## What Exists

- `src/lib/transaction-review.ts`
- `POST /api/transaction-review`
- Console tab: `Tx review`
- Purpose mapping for:
  - collateral deposit,
  - loan payout,
  - collateral release,
  - liquidation.
- Approval state for:
  - borrower,
  - lender,
  - arbiter,
  - operator.
- `canMoveToSigning(review)` guard.
- Simnet unsigned-builder seam for release and liquidation previews.
- Guarded simnet wallet RPC client for unsigned-only methods.
- RPC-backed builder scaffold for creating unsigned release/liquidation previews from confirmed simnet escrow UTXOs.
- Signing-session creation after a review reaches `ready_for_signing`.
- Fixture signature verification for sample externally signed hex.
- Broadcast-review gate for completed signing sessions.

## Signing Readiness Rule

A review can move to signing only when all of these are true:

1. Review status is `ready_for_signing`.
2. Blockers are empty.
3. Every required approval role is true.
4. An unsigned transaction preview exists with raw transaction hex.
5. Server signing, server broadcast, and server private-key storage remain disabled.

Demo and default simnet reviews intentionally fail this rule unless an unsigned preview and all required approvals are present.

## Purpose Rules

| Purpose | Required approvals | Current status |
| --- | --- | --- |
| `collateral_deposit` | borrower, operator | demo/review preview only |
| `loan_payout` | lender, operator | demo/review preview only |
| `collateral_release` | borrower, lender, operator | review preview plus simnet unsigned-builder scaffold |
| `liquidation` | lender, arbiter, operator | review preview plus liquidation-policy gates and simnet unsigned-builder scaffold |

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

## Signing Session Handoff

A review that passes `canMoveToSigning(review)` may be used to create a signing session.

The signing-session layer:

- maps required approval roles to signing roles,
- collects external signed hex submissions,
- rejects private-key-like fields,
- rejects unsigned raw transaction hex submitted as signed hex,
- tracks missing signatures,
- moves complete sessions to `ready_for_broadcast_review`.

The current signing-session implementation is fixture/demo-level. It does not prove real Decred signatures.

## Broadcast Review Handoff

`ready_for_broadcast_review` does not mean broadcast is allowed.

The broadcast-review gate:

- evaluates completed signing sessions,
- runs fixture signature verification,
- returns `blocked` or `manual_review`,
- keeps `canBroadcast: false`,
- requires operator approval before any future broadcast path.

There is still no app-side broadcast path.

## Liquidation Review

Liquidation review includes the liquidation automation policy decision. The policy can decide `warn`, `queue_review`, or `auto_liquidate`, but it still does not sign or broadcast. When oracle health, DEX depth, or grace-period checks fail, blockers are copied into the transaction review envelope.

Do not describe liquidation automation as production-ready. The current work is review, queue, alert, and circuit-break groundwork, not execution.

## Current Blockers

- Demo adapter is not connected to dcrd or dcrwallet.
- Default simnet builder is blocked.
- RPC-backed builder has not been proven against a running simnet.
- Real Decred signature verification is not implemented.
- Broadcast-review gate is not yet exposed through API/UI.
- No production broadcast adapter exists.
- No mainnet path exists.

## Next Implementation Step

Expose the broadcast-review gate through a review-only API/helper and UI action, while keeping `canBroadcast: false` and keeping broadcast disabled.

After that, continue simnet proof work. The RPC-backed unsigned builder should output unsigned raw transaction previews only. Signing must remain outside the app-owned server process.
