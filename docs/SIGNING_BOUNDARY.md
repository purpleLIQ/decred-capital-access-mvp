# Decred Signing Boundary

This app must keep demo behavior, simnet transaction construction, and real signing clearly separated.

## Current State

The current app uses a demo Decred adapter. It can:

- create deterministic escrow previews
- show a 2-of-3 multisig checklist
- create blocked transaction review envelopes
- explain what approvals would be needed
- expose approval state for borrower, lender, arbiter, and operator
- show liquidation policy blockers inside liquidation reviews

It cannot:

- connect to mainnet
- build a real raw transaction
- sign a transaction
- store private keys
- broadcast a transaction

## Adapter Modes

| Mode | Purpose | Signing |
| --- | --- | --- |
| `demo` | UI and workflow preview | Disabled |
| `simnet` | isolated Decred transaction testing | Disabled until review flow exists |
| `testnet` | later public test network validation | Not implemented |
| `mainnet` | future production network | Not implemented |

## Required Boundary

Before any real signing work exists, the app needs:

1. Simnet wallet RPC wiring.
2. Simnet-only unsigned transaction builder.
3. Exact transaction inputs, outputs, fees, and redeem-script display.
4. Explicit borrower, lender, arbiter, and operator approval states.
5. A rule that server-side code does not store private keys.
6. A separate signing path, ideally wallet-side or client-side.
7. Operator warnings for liquidation and degraded oracle states.
8. Broadcast disabled until signed transaction validation is proven.

## Transaction Review Layer

The current branch adds `src/lib/transaction-review.ts` and `POST /api/transaction-review`.

`canMoveToSigning(review)` returns true only if:

- review status is `ready_for_signing`,
- blockers are empty,
- every required approval is present,
- unsigned raw transaction hex exists,
- server signing is disabled,
- server broadcast is disabled,
- server private-key storage is disabled.

Demo and current simnet reviews are blocked because no real unsigned transaction builder exists.

## Production Rule

The server can prepare and display unsigned transaction data. It should not custody private keys or silently sign transactions.

Mainnet support should remain blocked until simnet has proven the full collateral deposit, payout, repayment, release, and liquidation paths.

Production must not rely on a person manually remembering liquidation. Automation may evaluate risk, queue transaction reviews, alert operators, retry failed jobs, and trigger circuit breakers. Real signing and broadcast remain gated until simnet/testnet prove the review and signing model.
