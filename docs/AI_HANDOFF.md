# AI Handoff

You are continuing the Decred Capital Access MVP repo.

Repository: `https://github.com/purpleLIQ/decred-capital-access-mvp`

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

This is a Decred-native lending prototype. It currently demonstrates simnet-proof preparation, transaction-review structure, non-custodial signing-session groundwork, fixture signature verification, and broadcast-review gating with broadcasting disabled.

Do not describe it as real lending, production-ready, mainnet-ready, or proven trust-minimized lending.

Current prototype positioning:

```text
Decred-native DCR-backed lending prototype.
Simnet proof + non-custodial signing groundwork.
Not production-ready.
Not mainnet-ready.
No real funds.
No app-side signing.
No app-side broadcasting.
No production liquidation execution.
```

## Target Product Direction

Build toward the ideal architecture while keeping dangerous capabilities behind proof gates:

- native DCR collateral,
- native BTC, USDC, and USDT borrow assets,
- no bridges,
- no app custody,
- no app-side private keys,
- supplier offers and soft-pool UX before true pooled custody,
- partial loan fulfillment,
- supplier interest only on filled amounts,
- borrower-facing fast turnaround,
- 1% DCR platform fee in the collateral funding transaction,
- 70% platform / 30% arbiter reserve initial split, configurable,
- arbiter intervention before automatic fallback liquidation,
- automatic fallback liquidation as a future target after simnet proof,
- privacy-first evidence commitments on Decred,
- optional future public/Treasury funding requests for loans over $10,000 equivalent,
- arbiter-agent Skill later, after evidence schema and arbiter APIs exist.

## Hard Safety Boundaries

The app must not currently:

- sign transactions server-side,
- hold private keys,
- unlock wallets,
- import or export private keys,
- ask users for private keys, seeds, mnemonics, wallet files, passphrases, or xprvs,
- silently broadcast transactions,
- broadcast anything on mainnet,
- execute production liquidation,
- call wallet RPC from broadcast/signing UI paths,
- claim production readiness,
- claim real lending is live,
- claim mainnet readiness,
- claim trustless escrow is proven,
- claim automatic liquidation is production-ready.

Allowed current behavior:

- demo-only UI,
- simnet/test fixture flows,
- unsigned transaction previews,
- external signed-hex collection,
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
  - `src/lib/broadcast-review-store.ts`
  - `src/lib/broadcast-review-api-handlers.ts`
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
- Broadcast-review store/API handler.
- Broadcast-review route wrapper:
  - `src/app/api/broadcast-reviews/route.ts`
- Broadcast-review UI on `/signing-sessions`.
- Existing broadcast review reuse for a signing session.

## Current Transaction Lifecycle

Current implemented lifecycle:

```text
transaction review
-> ready_for_signing
-> signing session
-> external borrower/lender or lender/arbiter signed hex collection
-> ready_for_broadcast_review
-> broadcast review gate
-> blocked or manual_review
-> no broadcast path
```

Current implemented test UI flow:

```text
/signing-sessions
-> Create sample signing session
-> paste borrower fake signed hex
-> paste lender fake signed hex
-> session becomes ready_for_broadcast_review
-> Create/Load broadcast review
-> review shows blocked or manual_review with canBroadcast false
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

Do not use unsigned sample hex as submitted signed hex. That should be rejected.

## Roadmap Docs

Current roadmap documents:

- `docs/ROADMAP.md`
- `docs/DECRED_NATIVE_LENDING_INFRA.md`
- `docs/LIQUIDITY_SUPPLIERS.md`
- `docs/CROSS_CHAIN_BORROWING.md`
- `docs/LIQUIDATION_AND_ARBITERS.md`
- `docs/EVIDENCE_COMMITMENTS.md`
- `docs/NON_CUSTODIAL_SIGNING.md`
- `docs/OPERATIONS.md`

Use these docs to prevent scope drift.

## Next Development Work

Recommended next PRs after the roadmap docs:

1. Add protocol domain foundation:
   - borrow assets BTC/USDC/USDT,
   - DCR collateral asset,
   - loan requests,
   - supplier offers,
   - supplier fills,
   - supplier positions,
   - funding states,
   - interest config,
   - platform fee config.
2. Add supplier offer and partial-fill state machine.
3. Add platform fee and blended APR calculations.
4. Add oracle and liquidation policy scaffolding.
5. Add evidence bundle and hash commitment scaffolding.
6. Add Decred collateral contract template plan/scaffold.

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

## Connector Caveat

Direct GitHub connector writes to `src/app/api/**/route.ts` may be blocked by safety filters. Avoid repeatedly trying blocked route writes.

Accepted workaround:

- create pure helpers in `src/lib/**`,
- create UI in `src/components/**`,
- if route files are required and connector blocks them, give the user exact local PowerShell instructions to create thin route wrappers manually.

## Do Not Claim Yet

- Production-ready.
- Mainnet-ready.
- Real lending is live.
- Real signatures are verified.
- Real simnet escrow is proven.
- Testnet is proven.
- Trustless lending is proven.
- Trust-minimized arbiter is implemented.
- Automatic liquidation is production-ready.
- Real liquidation execution works.
- Broadcasting is implemented.
- Treasury request integration works.
- Arbiter-agent Skill exists.
