# Non-Custodial Signing Model

This document defines the signing boundary for the Decred Capital Access MVP.

The app may prepare unsigned transaction previews, create signing sessions, collect externally signed transaction hex, track which roles have submitted signatures, and decide whether a transaction is ready for broadcast review. It must not hold private keys, unlock wallets, sign through wallet RPC, or broadcast automatically.

## Current Scope

Implemented in `src/lib/signing-collection.ts`:

- creates a signing session from a transaction review,
- maps required approval roles to signing roles,
- handles borrower, lender, and arbiter signing roles,
- rejects submissions containing private-key-like fields,
- rejects a pasted unsigned raw transaction as if it were a signature,
- tracks missing role signatures,
- marks a complete session as `ready_for_broadcast_review` only after all required external signatures are present.

Implemented as API/store/UI groundwork:

- request schemas in `src/lib/api-schemas.ts`,
- in-memory demo session store in `src/lib/signing-session-store.ts`,
- API handlers in `src/lib/signing-session-api-handlers.ts`,
- route wrappers:
  - `src/app/api/signing-sessions/route.ts`,
  - `src/app/api/signing-sessions/submissions/route.ts`,
- standalone UI in `src/components/signing-session-panel.tsx`,
- `/signing-sessions` page,
- tests for schema, store, handler, and collection behavior.

The store is prototype-only. Production needs a database-backed implementation with auth, audit logs, replay protection, session expiry, and stronger abuse controls.

## Current Demo Flow

The current test UI flow is:

```text
/signing-sessions
→ Create sample signing session
→ paste borrower fake signed hex
→ paste lender fake signed hex
→ session becomes ready_for_broadcast_review
```

Fixture signed hex values for the sample flow:

```text
01000000signedborrower_sample
01000000signedlender_sample
```

The fixture verifier expects signed hex to start with:

```text
01000000signed
```

Do not use unsigned sample hex as submitted signed hex. That should be rejected.

## Allowed

- Display unsigned transaction hex.
- Tell a borrower, lender, or arbiter to sign outside the app-owned server process.
- Accept externally signed transaction hex.
- Replace a prior submission from the same role.
- Track missing role signatures.
- Move a complete signing session to `ready_for_broadcast_review`.
- Run fixture signature verification against sample signed hex.
- Send a completed session into a broadcast-review gate that still keeps broadcasting disabled.

## Not Allowed

- Server-side private keys.
- Wallet seed phrases.
- Mnemonics.
- Wallet files.
- xprvs.
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

A transaction still needs the review layer before signing collection. Signing collection starts only after the review is `ready_for_signing`, has no blockers, includes required approvals, and includes unsigned raw transaction hex.

Lowercase review approval roles are accepted by the signing-session flow and mapped into the signing role model.

## Signature Verification Status

Current signature verification is fixture-level only.

Implemented in `src/lib/signature-verification.ts`:

- accepts sample externally signed hex that starts with `01000000signed`,
- rejects missing or malformed fixture signed hex,
- supports broadcast-review tests and demo UI state transitions.

It does not perform real Decred transaction signature verification yet. Do not describe the sample flow as proving real Decred signatures.

## Broadcast Boundary

`ready_for_broadcast_review` does not mean broadcast is allowed. It means the signing session has enough external signed-hex submissions for the broadcast-review layer to inspect.

Implemented in `src/lib/broadcast-review.ts`, the current broadcast-review gate:

- evaluates completed `ready_for_broadcast_review` signing sessions,
- runs fixture signature verification for each external signature submission,
- returns `blocked` or `manual_review`,
- keeps `canBroadcast: false`,
- requires operator approval before any future broadcast path.

Broadcast remains out of scope for this phase. There is no broadcast button, no production broadcast adapter, and no mainnet broadcast path.

## Next Work

1. Expose the broadcast-review gate through a review-only API/helper.
2. Add a UI action on `/signing-sessions` to create a broadcast review.
3. Display broadcast-review status, blockers, warnings, and fixture signature results.
4. Keep `canBroadcast: false`.
5. Replace fixture signature verification with real Decred signature verification after simnet proof work is ready.
6. Prove the full path in simnet before testnet.
