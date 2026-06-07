# Decred Signing Boundary

This app must keep demo behavior, simnet transaction construction, and real signing clearly separated.

## Current State

The current app uses a demo Decred adapter. It can:

- create deterministic escrow previews
- show a 2-of-3 multisig checklist
- create blocked transaction review objects
- explain what approvals would be needed

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

1. A transaction review screen.
2. Unsigned transaction previews.
3. Explicit borrower, lender, and arbiter approval states.
4. A rule that server-side code does not store private keys.
5. A separate signing path, ideally wallet-side or client-side.
6. Operator warnings for liquidation and degraded oracle states.

## Production Rule

The server can prepare and display unsigned transaction data. It should not custody private keys or silently sign transactions.

Mainnet support should remain blocked until simnet has proven the full collateral deposit, payout, repayment, release, and liquidation paths.
