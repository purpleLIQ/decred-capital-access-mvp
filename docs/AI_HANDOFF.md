# AI Handoff

You are continuing the Decred Capital Access MVP repo.

Repository: `https://github.com/purpleLIQ/decred-capital-access-mvp`

Local path used by the project owner:

```text
C:\Users\jcrea\Documents\New project 5\decred-capital-access-mvp
```

Default branch: `main`

Package manager: `npm`

Run locally:

```bash
npm install
npm run demo
```

Verify:

```bash
npm run verify
```

## Project Positioning

This is a Decred-native DCR-backed lending MVP prototype. It demonstrates simnet-proof preparation and non-custodial signing groundwork with fixture/sample data. It is not production-ready, not mainnet-ready, and must not be described as real lending.

Current positioning:

```text
Decred-native DCR-backed lending MVP prototype.
Simnet proof + non-custodial signing groundwork.
Not production-ready.
Not mainnet-ready.
No real funds.
No app-side signing.
No app-side broadcasting.
```

## Hard Safety Boundaries

The app must not:

- sign transactions server-side,
- hold private keys,
- unlock wallets,
- import or export private keys,
- ask users for private keys, seeds, mnemonics, wallet files, passphrases, or xprvs,
- silently broadcast transactions,
- broadcast anything on mainnet,
- execute liquidation,
- call wallet RPC from broadcast/signing UI paths,
- claim production readiness,
- claim real lending is live,
- claim mainnet readiness,
- claim trustless escrow is proven,
- claim liquidation automation is production-ready.

Allowed current behavior:

- demo-only UI,
- simnet/test fixture flows,
- unsigned transaction previews,
- external signed hex collection,
- fixture signature verification,
- broadcast-review gate decisions with broadcasting disabled,
- local JSON simnet proof artifacts,
- docs, runbooks, and checklists.

## Current App State

- Next.js + TypeScript app.
- Demo-only local app with persistent SQLite via `sql.js`.
- Live market data is best-effort and safely falls back to seeded demo values.
- Main pages:
  - `/console`
  - `/ops`
  - `/signing-sessions`
- Main UI files:
  - `src/components/borrow-flow.tsx`
  - `src/components/demo-console.tsx`
  - `src/components/ops-dashboard.tsx`
  - `src/components/signing-session-panel.tsx`
- Core behavior:
  - `src/lib/loan-state-machine.ts`
  - `src/lib/risk.ts`
  - `src/lib/price-oracle.ts`
  - `src/lib/demo-db.ts`
  - `src/lib/liquidation-policy.ts`
  - `src/lib/transaction-review.ts`
  - `src/lib/signing-collection.ts`
  - `src/lib/signing-session-store.ts`
  - `src/lib/signing-session-api-handlers.ts`
  - `src/lib/signature-verification.ts`
  - `src/lib/broadcast-review.ts`
  - `src/lib/adapters/*`

## Completed Work

- Demo lending console with borrower quote flow and operator actions.
- `/console` and `/ops` surfaces.
- Transaction review envelope model.
- Approval state model for borrower, lender, arbiter, and operator.
- `canMoveToSigning(review)` guard.
- `POST /api/transaction-review`.
- Console transaction-review tab.
- Blocked demo and simnet review generation.
- Simnet wallet RPC configuration.
- Simnet unsigned-builder seam.
- Guarded simnet wallet RPC client scaffold for unsigned-only methods.
- RPC-backed unsigned release/liquidation builder scaffold for confirmed simnet escrow UTXOs.
- Liquidation review integration with liquidation policy blockers.
- Root docs organized under `docs/`, with `AGENTS.md` and `CLAUDE.md` kept as small compatibility stubs.
- Safety tests for schema validation, adapters, liquidation policy, state machine, transaction review, unsigned-builder guardrails, signing collection, signing sessions, signature verification, and broadcast review.
- Non-custodial signing collection model.
- Signing-session store and API handler layer.
- Signing-session route wrappers:
  - `src/app/api/signing-sessions/route.ts`
  - `src/app/api/signing-sessions/submissions/route.ts`
- Signing-session UI at `/signing-sessions`.
- Lowercase review approval role mapping for signing sessions.
- Fixture signature verification for sample externally signed hex.
- Broadcast-review gate in `src/lib/broadcast-review.ts`.

## Current Transaction Lifecycle

The intended lifecycle is:

```text
transaction review
→ ready_for_signing
→ signing session
→ external borrower/lender or lender/arbiter signed hex collection
→ ready_for_broadcast_review
→ broadcast review gate
→ manual/operator review
→ future broadcast adapter, still disabled until simnet proof
```

Current implemented test UI flow:

```text
/signing-sessions
→ Create sample signing session
→ paste borrower fake signed hex
→ paste lender fake signed hex
→ session becomes ready_for_broadcast_review
```

Use these fake hex values for UI testing:

```text
01000000signedborrower_sample
01000000signedlender_sample
```

The fixture verifier expects submitted signed hex to start with:

```text
01000000signed
```

Do not use the unsigned sample hex as submitted signed hex. That should be rejected.

## Transaction Review Status

Transaction reviews are previews only. A review can move to signing only when:

- status is `ready_for_signing`,
- blockers are empty,
- required approvals are true,
- unsigned raw transaction hex exists,
- server signing, broadcasting, and private-key storage remain disabled.

Review statuses include:

- `blocked`
- `draft`
- `ready_for_signing`

## Signing Session Status

The signing-session flow can collect external signed hex submissions and move a session to `ready_for_broadcast_review` when all required roles have submitted fixture-valid signed hex.

Current signing-session behavior is still fixture/demo-level. The app does not perform real Decred signature verification yet.

Important files:

- `src/lib/signing-collection.ts`
- `src/lib/signing-session-store.ts`
- `src/lib/signing-session-api-handlers.ts`
- `src/components/signing-session-panel.tsx`
- `src/app/api/signing-sessions/route.ts`
- `src/app/api/signing-sessions/submissions/route.ts`

## Broadcast Review Status

The broadcast-review gate is implemented as a pure library layer in `src/lib/broadcast-review.ts`.

It:

- evaluates completed `ready_for_broadcast_review` signing sessions,
- runs fixture signature verification for each external signature submission,
- returns `blocked` or `manual_review`,
- keeps `canBroadcast: false`,
- requires operator approval before any future broadcast path.

It does not:

- sign,
- broadcast,
- unlock wallets,
- handle private keys,
- call wallet RPC,
- execute liquidation.

The gate is not yet exposed through API/UI. The next development stage may add a review-only API/helper and a UI button such as `Create broadcast review`, but it must still keep broadcasting disabled.

## Simnet Proof Harness

Current harness commands:

- `npm run simnet:check-config`
- `npm run simnet:probe-rpc`
- `npm run simnet:inspect-escrow-utxos`
- `npm run simnet:build-unsigned-preview`
- `npm run simnet:validate-artifacts`
- `npm run simnet:fixture-proof`

Harness files include:

- `scripts/simnet-proof/check-config.mjs`
- `scripts/simnet-proof/probe-rpc.mjs`
- `scripts/simnet-proof/inspect-escrow-utxos.mjs`
- `scripts/simnet-proof/build-unsigned-preview.mjs`
- `scripts/simnet-proof/validate-artifacts.mjs`
- `scripts/simnet-proof/fixture-proof.mjs`
- `docs/SIMNET_RUNBOOK.md`

The fixture proof creates local JSON artifacts only. It does not prove a real simnet transaction path and must not be described as real simnet proof.

The RPC-backed harness may use read-only/unsigned wallet calls such as UTXO inspection and unsigned transaction construction. It must not sign, unlock wallets, export/import keys, broadcast, or execute liquidation.

## Known Recent PRs

- PR #36: Add signing session route wrappers — merged.
- PR #44: Add session console surface — stale/obsolete/conflicting; do not merge. Close it if it is still open.
- PR #45: Enable standalone signing session flow — merged.
- PR #46: Accept lowercase review approval roles in signing sessions — merged.
- PR #47: Add broadcast review gate — merged.

## Connector Caveat

Direct GitHub connector writes to `src/app/api/**/route.ts` may be blocked by safety filters. Avoid repeatedly trying blocked route writes.

Accepted workaround:

- create pure helpers in `src/lib/**`,
- create UI in `src/components/**`,
- if route files are required and connector blocks them, give the user exact local PowerShell instructions to create thin route wrappers manually.

Route wrappers already exist for signing sessions. Do not recreate them unless they are missing.

## Recommended Next Work

Recommended docs refresh sequence:

1. Update `docs/AI_HANDOFF.md` with the current repo state.
2. Update `README.md` and `ROADMAP.md`.
3. Update detailed docs related to signing, broadcast review, simnet, operations, and safety boundaries.

Recommended next development stage after docs refresh:

1. Expose the broadcast-review gate through a review-only API/helper.
2. Add a UI action on the signing-session page to create a broadcast review.
3. Display review status, blockers, warnings, and fixture signature results.
4. Keep `canBroadcast: false`.
5. Do not add a broadcast button.
6. Do not add RPC, signing, wallet unlock, private-key handling, or liquidation execution.

Likely files for the next development stage:

- `src/lib/broadcast-review-store.ts`
- `src/lib/broadcast-review-api-handlers.ts`
- `src/lib/__tests__/broadcast-review-api-handlers.test.ts`
- `src/components/signing-session-panel.tsx`
- `src/app/api/broadcast-reviews/route.ts` if a route wrapper can be safely added.

## Do Not Claim Yet

- Production-ready.
- Mainnet-ready.
- Real lending is live.
- Real signatures are verified.
- Real simnet escrow is proven.
- Testnet is proven.
- Trustless lending is proven.
- Trust-minimized arbiter is implemented.
- Liquidation automation is production-ready.
- Real liquidation execution works.
- Broadcasting is implemented.
- Legal/compliance clearance.
