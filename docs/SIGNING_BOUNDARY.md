# Decred Signing Boundary

This app must keep demo behavior, simnet transaction construction, external signing, broadcast review, and real network broadcast clearly separated.

The current rule is simple: the app server may prepare and review transaction data, but it must not custody secrets, unlock wallets, sign transactions, or broadcast transactions.

## Current State

The app can:

- create deterministic escrow previews,
- show a 2-of-3 multisig checklist,
- create transaction review envelopes,
- explain required approvals,
- expose approval state for borrower, lender, arbiter, and operator,
- show liquidation policy blockers inside liquidation reviews,
- create signing sessions from ready transaction reviews,
- collect externally signed transaction hex for borrower, lender, and arbiter roles,
- verify fixture/sample signed hex,
- move complete signing sessions to `ready_for_broadcast_review`,
- run a pure broadcast-review gate that returns `blocked` or `manual_review` while keeping `canBroadcast: false`.

It cannot:

- connect to mainnet,
- verify real Decred signatures,
- sign a transaction,
- store private keys,
- unlock wallets,
- broadcast a transaction,
- execute liquidation.

## Adapter Modes

| Mode | Purpose | Signing | Broadcast |
| --- | --- | --- | --- |
| `demo` | UI and workflow preview | Disabled | Disabled |
| `simnet` | isolated Decred transaction testing | External only; not app-server signing | Disabled until proof and review gates are complete |
| `testnet` | later public test network validation | Not implemented | Not implemented |
| `mainnet` | future production network | Not implemented | Not implemented |

## Required Boundary

Before any real-money path exists, the app needs:

1. Simnet wallet RPC wiring for safe unsigned/read-only builder work.
2. Simnet-only unsigned transaction builders proven against running wallets.
3. Exact transaction inputs, outputs, fees, redeem scripts, and raw unsigned hex display.
4. Explicit borrower, lender, arbiter, and operator approval states.
5. A rule that server-side code never stores private keys, seeds, mnemonics, xprvs, wallet files, or passphrases.
6. A separate signing path outside the app-owned server process.
7. Real Decred signature verification after fixture verification.
8. Operator warnings for liquidation and degraded oracle states.
9. Broadcast review that remains separate from signing collection.
10. Broadcast disabled until signed transaction validation, operator approval, simnet proof, and testnet proof are complete.

## Transaction Review Layer

`src/lib/transaction-review.ts` and `POST /api/transaction-review` define the first gate before signing collection.

`canMoveToSigning(review)` returns true only if:

- review status is `ready_for_signing`,
- blockers are empty,
- every required approval is present,
- unsigned raw transaction hex exists,
- server signing is disabled,
- server broadcast is disabled,
- server private-key storage is disabled.

Demo and current default simnet reviews are blocked unless an unsigned preview and all required approvals are present.

## Signing Collection Layer

`src/lib/signing-collection.ts`, `src/lib/signing-session-store.ts`, and `src/lib/signing-session-api-handlers.ts` define the current signing-session layer.

Signing collection may:

- create a session from a ready transaction review,
- map required approval roles to signing roles,
- accept externally signed transaction hex,
- reject private-key-like fields,
- reject unsigned raw transaction hex submitted as signed hex,
- track missing signatures,
- move a complete session to `ready_for_broadcast_review`.

Signing collection must not:

- call wallet RPC signing methods,
- ask for or store wallet secrets,
- unlock wallets,
- broadcast,
- imply fixture signatures are real Decred signatures.

## Broadcast Review Layer

`src/lib/broadcast-review.ts` defines the current broadcast-review gate.

The gate may:

- evaluate a completed `ready_for_broadcast_review` signing session,
- run fixture signature verification for each external signature submission,
- return `blocked` or `manual_review`,
- keep `canBroadcast: false`,
- require operator approval before any future broadcast path.

The gate must not:

- sign,
- broadcast,
- unlock wallets,
- handle private keys,
- call wallet RPC,
- execute liquidation.

## Production Rule

The server can prepare and display unsigned transaction data and coordinate review state. It should not custody private keys or silently sign transactions.

Mainnet support must remain blocked until simnet and testnet prove the full collateral deposit, payout, repayment, release, broadcast-review, and liquidation-review paths.

Production must not rely on a person manually remembering liquidation. Automation may evaluate risk, queue transaction reviews, alert operators, retry failed jobs, and trigger circuit breakers. Real signing and broadcast remain gated until simnet/testnet prove the review and signing model.
