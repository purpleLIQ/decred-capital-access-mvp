# Windows Simnet Setup Guide

This guide helps run the local simnet proof harness from PowerShell. It does not enable signing, wallet unlock, private-key handling, broadcast, or liquidation execution.

## Goal

Get from a clean local checkout to safe harness output:

```powershell
npm run verify
npm run simnet:check-config
npm run simnet:probe-rpc
npm run simnet:build-unsigned-preview
```

The last command only works after a real simnet escrow address has confirmed UTXOs.

## Safety Boundary

Allowed here:

- set local simnet environment variables,
- check config,
- probe wallet RPC with `listunspent`,
- build unsigned raw transaction previews with `createrawtransaction`.

Not allowed here:

- mainnet endpoints,
- server-side private keys,
- wallet unlock from this app,
- signing RPC calls,
- broadcast RPC calls,
- liquidation execution.

## 1. Update Local Repo

```powershell
git checkout main
git pull origin main
npm install
npm run verify
```

## 2. Load PowerShell Env Template

Open `scripts/simnet-proof/env-template.ps1` and copy it somewhere local if you want to keep private values out of the repo.

Fill in only local simnet values. Do not commit real RPC passwords.

Then run:

```powershell
. .\scripts\simnet-proof\env-template.ps1
```

The leading dot matters. It loads variables into the current PowerShell session.

## 3. Check Config

```powershell
npm run simnet:check-config
```

A successful config check returns JSON with:

```json
{
  "ok": true,
  "network": "simnet",
  "readyForWalletRpcProbe": true
}
```

If values are missing, the command returns blockers. That is expected until the template is filled.

## 4. Start Local Simnet Services

Run isolated local Decred simnet services outside this app:

- one `dcrd` simnet node,
- one borrower `dcrwallet`,
- one lender `dcrwallet`,
- one arbiter `dcrwallet`.

Each wallet needs separate RPC credentials and ports. The template assumes:

```text
borrower wallet RPC: http://127.0.0.1:19557
lender wallet RPC:   http://127.0.0.1:19558
arbiter wallet RPC:  http://127.0.0.1:19559
```

Those ports are placeholders. Use the real values from your local wallet commands.

## 5. Probe Wallet RPC

```powershell
npm run simnet:probe-rpc
```

This calls `listunspent` only. It does not call signing, unlock, key export/import, broadcast, or liquidation methods.

A successful probe returns each wallet role with an `ok: true` result.

## 6. Prepare Unsigned Preview Inputs

After a real simnet escrow address exists and has confirmed UTXOs, fill these values:

```powershell
$env:SIMNET_PREVIEW_PURPOSE = "collateral_release"
$env:SIMNET_PREVIEW_LOAN_ID = "simnet_proof_loan"
$env:SIMNET_PREVIEW_ESCROW_ADDRESS = "..."
$env:SIMNET_PREVIEW_REDEEM_SCRIPT = "..."
$env:SIMNET_PREVIEW_COLLATERAL_DCR = "..."
$env:SIMNET_PREVIEW_DESTINATION_ADDRESS = "..."
$env:SIMNET_PREVIEW_FEE_DCR = "0.001"
$env:SIMNET_PREVIEW_MIN_CONFIRMATIONS = "1"
$env:SIMNET_PREVIEW_OUTPUT_PATH = "artifacts/simnet/unsigned-release-preview.json"
```

For liquidation preview testing:

```powershell
$env:SIMNET_PREVIEW_PURPOSE = "liquidation"
$env:SIMNET_PREVIEW_OUTPUT_PATH = "artifacts/simnet/unsigned-liquidation-preview.json"
```

Release previews use the borrower wallet role. Liquidation previews use the lender wallet role.

## 7. Build Unsigned Preview

```powershell
npm run simnet:build-unsigned-preview
```

Expected success:

- `ok: true`,
- `network: simnet`,
- `unsignedTransaction.rawTransactionHex` is present,
- artifact is written to `SIMNET_PREVIEW_OUTPUT_PATH` if set.

Expected safe failure before escrow is funded:

```text
No confirmed simnet UTXOs found for escrow address ...
```

That failure is good. It means the harness did not invent money and did not bypass the escrow proof.

## 8. Capture Proof Notes

For a future PR or proof log, capture:

- `npm run verify` output,
- `npm run simnet:check-config` output,
- `npm run simnet:probe-rpc` output,
- `npm run simnet:build-unsigned-preview` output,
- wallet role mapping,
- escrow address,
- UTXO count and confirmations,
- unsigned preview artifact path,
- blockers or failures.

Do not commit private RPC passwords or sensitive local wallet files.

## Current Stop Point

Stop after unsigned preview creation. The next product phase is non-custodial signing collection, but only after the simnet unsigned path is proven and reviewed.
