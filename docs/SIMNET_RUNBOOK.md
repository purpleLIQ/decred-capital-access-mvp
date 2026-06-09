# Simnet Proof Runbook

This runbook is for the first real-network proof path. It is intentionally limited to configuration checks, read-only RPC probing, escrow UTXO inspection, unsigned transaction preview construction, offline artifact validation, and fixture-only proof artifact generation.

## Boundary

Allowed in this phase:

- start isolated local simnet services,
- configure `dcrd` and separate borrower/lender/arbiter `dcrwallet` RPC endpoints,
- verify required environment variables,
- probe wallet RPC reachability with read-only calls such as `listunspent`,
- inspect whether escrow UTXOs exist,
- build unsigned release/liquidation preview artifacts with `createrawtransaction`,
- validate local JSON proof artifacts offline,
- generate fixture-only proof artifacts for local demo validation.

Not allowed in this phase:

- server-side private-key storage,
- wallet seeds, mnemonics, passphrases, wallet files, or xprvs in app config,
- wallet unlock from the app,
- signing RPC calls,
- raw transaction broadcast,
- liquidation execution,
- mainnet endpoints.

## Expected Local Services

Use isolated simnet services only:

- one `dcrd` simnet node,
- one borrower `dcrwallet`,
- one lender `dcrwallet`,
- one arbiter `dcrwallet`.

Each wallet must have its own RPC URL, user, password, and certificate path if TLS certificates are used locally.

## Environment

Start from `.env.example` and set only local simnet values. For Windows and PowerShell, see `docs/WINDOWS_SIMNET_SETUP.md` and `scripts/simnet-proof/env-template.ps1`.

Unsigned preview and escrow inspection commands need proof-specific values:

```bash
SIMNET_PREVIEW_PURPOSE=collateral_release
SIMNET_PREVIEW_LOAN_ID=simnet_proof_loan
SIMNET_PREVIEW_ESCROW_ADDRESS=...
SIMNET_PREVIEW_REDEEM_SCRIPT=...
SIMNET_PREVIEW_COLLATERAL_DCR=...
SIMNET_PREVIEW_DESTINATION_ADDRESS=...
SIMNET_PREVIEW_FEE_DCR=0.001
SIMNET_PREVIEW_MIN_CONFIRMATIONS=1
SIMNET_PREVIEW_OUTPUT_PATH=artifacts/simnet/unsigned-release-preview.json
SIMNET_UTXO_INSPECTOR_OUTPUT_PATH=artifacts/simnet/escrow-utxos.json
```

For liquidation previews, use `SIMNET_PREVIEW_PURPOSE=liquidation`. Release previews use the borrower wallet RPC role. Liquidation previews use the lender wallet RPC role.

Do not commit a populated `.env` file or generated proof artifacts that contain sensitive local details.

## Harness Commands

Check required config without making RPC calls:

```bash
npm run simnet:check-config
```

Probe wallet RPC reachability using read-only wallet calls:

```bash
npm run simnet:probe-rpc
```

Inspect the configured escrow address UTXOs:

```bash
npm run simnet:inspect-escrow-utxos
```

Build an unsigned simnet preview artifact:

```bash
npm run simnet:build-unsigned-preview
```

Validate local proof artifacts offline:

```bash
npm run simnet:validate-artifacts
```

Generate fixture-only local proof artifacts:

```bash
npm run simnet:fixture-proof
```

Run the normal project verification suite:

```bash
npm run verify
```

## Fixture Proof Note

`npm run simnet:fixture-proof` creates local JSON artifacts only. It is useful for checking the artifact shape and review/signing/broadcast-review handoff language, but it does not prove a real simnet transaction path.

Do not describe fixture proof output as:

- real simnet escrow proof,
- real Decred signature verification,
- production readiness,
- mainnet readiness.

## Proof Artifacts To Capture

Capture these in a local proof log or PR comment when simnet is running:

- `npm run simnet:check-config` output,
- `npm run simnet:probe-rpc` output,
- `npm run simnet:inspect-escrow-utxos` output,
- `npm run simnet:build-unsigned-preview` output,
- `npm run simnet:validate-artifacts` output,
- `npm run simnet:fixture-proof` output if used, clearly labeled fixture-only,
- wallet role mapping,
- escrow address used for the test loan,
- UTXO count and confirmation status,
- unsigned review envelope snapshot once raw transaction preview is proven,
- signing-session snapshot,
- broadcast-review snapshot when exposed,
- any blocker output.

## App-Level Smoke Test

After artifact commands pass, run:

```bash
npm run demo
```

Open:

```text
http://localhost:3000/console
http://localhost:3000/signing-sessions
```

Confirm:

1. Transaction review can show the relevant review state.
2. A signing session can collect external signed hex for required roles.
3. A complete signing session reaches `ready_for_broadcast_review`.
4. Broadcast review, once exposed through API/UI, returns review status while keeping `canBroadcast: false`.
5. No app-side signing or broadcast is required.

## Pass/Fail Rule

The proof fails if any step requires server-side private keys, wallet secrets in app config, wallet unlock from this app, signing RPC calls, silent broadcast, liquidation execution, or a mainnet assumption.
