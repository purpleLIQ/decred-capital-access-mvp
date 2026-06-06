# Simnet Harness Plan

This is the next protocol milestone. Keep this separate from the demo UI until the flow is proven.

## Goal

Prove that a borrower, lender, and arbiter can create and spend a 2-of-3 Decred multisig escrow on simnet.

## Wallet roles

- Borrower wallet: owns the DCR collateral and receives released collateral after repayment.
- Lender wallet: funds the loan and participates in release or liquidation signing.
- Arbiter wallet: independent recovery/liquidation signer.

## Required proof flow

1. Start `dcrd` in simnet mode.
2. Create three separate `dcrwallet` instances.
3. Generate one public key for each role.
4. Create a 2-of-3 multisig address with `createmultisig`.
5. Send simulated DCR collateral to the multisig address.
6. Confirm the collateral transaction.
7. Build a release transaction back to borrower custody.
8. Sign with borrower + lender.
9. Repeat with lender + arbiter to prove the recovery path.
10. Document commands and screenshots before any mainnet work.

## App integration checklist

- Add an adapter that returns real simnet `createmultisig` output.
- Keep the demo adapter available behind `DEMO_MODE=true`.
- Add transaction review UI before submitting signatures.
- Reject mainnet configuration unless an explicit production flag is set.
- Never write private keys to SQLite, logs, browser local storage, or environment files.
