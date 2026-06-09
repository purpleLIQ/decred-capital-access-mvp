# Simnet Collateral Release Proof

This runbook defines the next proof milestone: prove that the app can prepare a collateral release flow on simnet without server-side keys, wallet unlocks, or silent broadcast.

## Goal

Produce evidence that a Decred simnet collateral release can move through:

1. isolated wallet setup,
2. escrow UTXO discovery,
3. unsigned transaction preview,
4. transaction review,
5. external signature collection,
6. fixture or real signature verification depending on the current implementation stage,
7. broadcast-review readiness.

Broadcast remains a separate later gate unless explicitly enabled in a future simnet-only proof.

## Current Status

The app can already demonstrate the review and signing-session state flow with fixture/sample data. It can collect externally signed hex and move a completed session to `ready_for_broadcast_review`.

The broadcast-review gate is implemented as a pure library layer and keeps `canBroadcast: false`. It is not proof of real broadcast readiness.

Fixture signature verification is not real Decred signature verification.

## Required Safety Boundary

The proof fails if any step requires:

- server-side private keys,
- wallet seed phrases in app config,
- wallet passphrases in app config,
- wallet files in app config,
- xprvs in app config,
- wallet unlock calls from the app,
- `signrawtransaction` from the app server,
- `sendrawtransaction` from the app server,
- mainnet endpoints,
- real liquidation execution.

## Local Prerequisites

Run these locally, not in CI:

- `dcrd` running on simnet,
- three isolated `dcrwallet` instances:
  - borrower,
  - lender,
  - arbiter,
- funded simnet coins available for the borrower or funding wallet,
- app `.env.local` configured with simnet RPC values,
- `DCR_SIMNET_ENABLED=true`.

Do not put private keys, seeds, wallet files, xprvs, or wallet passphrases in `.env.local`.

## Proof Commands

Run from the repository root.

```bash
npm run simnet:check-config
npm run simnet:probe-rpc
npm run simnet:inspect-escrow-utxos
npm run simnet:build-unsigned-preview
npm run simnet:validate-artifacts
npm run verify
```

Optional fixture-only artifact check:

```bash
npm run simnet:fixture-proof
```

The fixture proof creates local JSON artifacts only. It does not prove real simnet escrow or real Decred signatures.

## Required Artifacts

Save or confirm these files under `artifacts/simnet/`:

```text
artifacts/simnet/check-config.json
artifacts/simnet/probe-rpc.json
artifacts/simnet/escrow-utxos.json
artifacts/simnet/unsigned-release-preview.json
artifacts/simnet/validate-artifacts.json
```

If fixture proof is run, clearly label its output as fixture-only.

## Evidence Checklist

A passing proof must show:

- config explicitly reports simnet mode,
- no mainnet-like RPC URL is accepted,
- dcrd RPC is reachable,
- wallet RPC endpoints are reachable only for safe read/build operations,
- escrow UTXO exists and is confirmed enough for the configured policy,
- unsigned collateral release preview is generated from real simnet UTXO data,
- generated preview includes loan ID, purpose, network, outputs, estimated fee, and raw unsigned hex,
- transaction review can be generated from the preview,
- signing session can collect external borrower/lender or lender/arbiter signatures,
- completed signing session reaches `ready_for_broadcast_review`,
- broadcast review keeps `canBroadcast: false`,
- no app code signs or broadcasts.

## Manual UI Smoke Test

After the artifact commands pass:

```bash
npm run demo
```

Open:

```text
http://localhost:3000/console
http://localhost:3000/signing-sessions
```

Then:

1. Open transaction review.
2. Select `Collateral release`.
3. Select `Simnet`.
4. Mark required approvals only when the generated review has no blockers.
5. Generate the review.
6. Open `Signing sessions` from the console link.
7. Create or load the signing session.
8. Submit externally signed transaction hex for the required roles.
9. Confirm the session status reaches `ready_for_broadcast_review`.
10. When broadcast review is exposed in the UI/API, confirm it returns `blocked` or `manual_review` while keeping `canBroadcast: false`.

## Pass Criteria

This proof passes when:

- all proof commands pass,
- all required artifacts exist,
- the app UI reaches `ready_for_broadcast_review`,
- broadcast review does not enable broadcast,
- no unsafe calls are needed,
- `npm run verify` passes.

## Fail Criteria

This proof fails if:

- any proof command needs mainnet,
- any proof command requires a private key in app config,
- wallet unlock is required from the app,
- the app signs a transaction,
- the app broadcasts a transaction,
- the generated transaction cannot be linked back to the approved review,
- the final signed payload changes outputs, fees, or purpose without a new review,
- fixture signature verification is described as real Decred signature verification.

## Next Development Step After Passing

After this proof passes, replace fixture signature verification with real Decred signature verification and expose broadcast review through API/UI while keeping broadcasting disabled.
