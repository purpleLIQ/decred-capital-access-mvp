# Non-Custodial Signing Model

This document defines the next boundary after simnet unsigned transaction proof.

The app may collect externally signed transaction payloads, track which roles have signed, and decide whether a transaction is ready for a later broadcast review. It must not hold private keys, unlock wallets, sign through wallet RPC, or broadcast automatically.

## Current Scope

Implemented in `src/lib/signing-collection.ts`:

- creates a signing session from a transaction review,
- maps required approval roles to signing roles,
- tracks borrower, lender, and arbiter external signature submissions,
- rejects submissions containing private-key-like fields,
- rejects a pasted unsigned raw transaction as if it were a signature,
- marks a session ready for later broadcast review only after all required external signatures are present.

## Allowed

- Display unsigned transaction hex.
- Tell a borrower, lender, or arbiter how to sign outside the app-owned server process.
- Accept externally signed transaction hex.
- Replace a prior submission from the same role.
- Track missing role signatures.
- Move a complete signing session to `ready_for_broadcast_review`.

## Not Allowed

- Server-side private keys.
- Wallet seed phrases.
- Wallet passphrases.
- Wallet unlock calls.
- `signrawtransaction` calls from this app.
- `sendrawtransaction` calls from this app.
- Silent broadcast.
- Mainnet signing collection.
- Liquidation execution.

## Role Rules

Operator approval is not a signing role. Current signing roles are:

- borrower,
- lender,
- arbiter.

A transaction still needs the review layer before signing collection. Signing collection starts only after the review is `ready_for_signing`, has no blockers, and includes unsigned raw transaction hex.

## Broadcast Boundary

`ready_for_broadcast_review` does not mean broadcast is allowed. It means a future broadcast-review layer may inspect signatures, validate final transaction details, require explicit operator action, and then decide whether broadcast is safe.

Broadcast remains out of scope for this phase.

## Next Work

1. Add a UI/API surface for signing sessions.
2. Add signature verification logic against Decred tooling in simnet.
3. Add a separate broadcast-review model.
4. Prove the full path in simnet before testnet.
