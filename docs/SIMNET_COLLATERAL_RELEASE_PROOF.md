# Simnet Collateral Release Proof

This runbook defines the next proof milestone: prove that the app can prepare a collateral release flow on simnet without server-side keys, wallet unlocks, or silent broadcast.

## Goal

Produce evidence that a Decred simnet collateral release can move through:

1. isolated wallet setup,
2. escrow UTXO discovery,
3. unsigned transaction preview,
4. transaction review,
5. external signature collection,
6. broadcast-review readiness.

Broadcast remains a separate later gate unless explicitly enabled in a future simnet-only proof.

## Required Safety Boundary

The proof fails if any step requires:

- server-side private keys,
- wallet seed phrases in app config,
- wallet passphrases in app config,
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

Do not put private keys, seeds, or wallet passphrases in `.env.local`.

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

## Required Artifacts

Save or confirm these files under `artifacts/simnet/`:

```text
artifacts/simnet/check-config.json
artifacts/simnet/probe-rpc.json
artifacts/simnet/escrow-utxos.json
artifacts/simnet/unsigned-release-preview.json
artifacts/simnet/validate-artifacts.json
```

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
- no app code signs or broadcasts.

## Manual UI Smoke Test

After the artifact commands pass:

```bash
npm run demo
```

Open:

```text
http://localhost:3000/console
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

## Pass Criteria

This proof passes when:

- all proof commands pass,
- all required artifacts exist,
- the app UI reaches `ready_for_broadcast_review`,
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
- the final signed payload changes outputs, fees, or purpose without a new review.

## Next Development Step After Passing

After this proof passes, add a separate `broadcast-review` model that verifies signed transaction details before any simnet broadcast is considered.
