# Simnet Collateral Release Proof Runbook

This runbook is the next milestone after the transaction-review and non-custodial signing-session UI work.

The goal is to prove one complete collateral release path on Decred simnet using isolated wallets and captured artifacts. This is not a mainnet or production runbook.

## Success Criteria

A run passes only if all of these are true:

- simnet RPC configuration passes validation,
- dcrd and isolated borrower, lender, and arbiter wallet RPC endpoints are reachable,
- at least one confirmed simnet escrow UTXO is inspected,
- an unsigned collateral-release transaction preview is generated from simnet data,
- the transaction-review layer marks the release as ready only after blockers are clear and required approvals are present,
- the signing-session flow accepts externally signed transaction hex from required roles,
- no server-side private keys are stored,
- no wallet unlock is performed by the app,
- no app-owned signing RPC is called,
- no silent broadcast occurs,
- no mainnet endpoint or mainnet address is used.

## Required Local Services

Run these locally before the proof run:

- `dcrd` on simnet,
- borrower `dcrwallet` on simnet,
- lender `dcrwallet` on simnet,
- arbiter `dcrwallet` on simnet.

Each wallet must use a distinct RPC endpoint and distinct credentials. Do not reuse a mainnet wallet.

## Environment

Start from the template:

```powershell
Copy-Item .\scripts\simnet-proof\env-template.ps1 .\scripts\simnet-proof\env.local.ps1
notepad .\scripts\simnet-proof\env.local.ps1
```

Load it in PowerShell:

```powershell
. .\scripts\simnet-proof\env.local.ps1
```

Required mode flag:

```powershell
$env:DCR_SIMNET_ENABLED="true"
```

## Proof Commands

Run these from the project root.

### 1. Verify config is safe

```powershell
npm run simnet:check-config
```

Expected artifact:

```text
artifacts/simnet/check-config.json
```

The command must pass without mainnet-looking endpoints or missing required wallet RPC values.

### 2. Probe RPC endpoints

```powershell
npm run simnet:probe-rpc
```

Expected artifact:

```text
artifacts/simnet/probe-rpc.json
```

The artifact should show dcrd and the borrower, lender, and arbiter wallet endpoints as reachable.

### 3. Inspect escrow UTXOs

```powershell
npm run simnet:inspect-escrow-utxos
```

Expected artifact:

```text
artifacts/simnet/escrow-utxos.json
```

The artifact should include at least one confirmed UTXO for the escrow script/address used by the test loan.

### 4. Build unsigned release preview

```powershell
npm run simnet:build-unsigned-preview
```

Expected artifact:

```text
artifacts/simnet/unsigned-release-preview.json
```

The artifact should include a simnet unsigned transaction preview. It must not include private keys, wallet passphrases, seeds, or signed/broadcast transaction state.

### 5. Validate artifacts

```powershell
npm run simnet:validate-artifacts
```

Expected result: pass.

If validation fails, do not proceed to signing-session testing.

## App-Level Review Flow

After proof artifacts pass:

1. Start the app:

```powershell
npm run demo
```

2. Open the console:

```text
http://localhost:3000/console
```

3. Generate a transaction review for collateral release.

4. Confirm that the review is blocked unless all required approvals and unsigned transaction data are present.

5. Open signing sessions from the console link:

```text
http://localhost:3000/signing-sessions
```

6. Create or load a signing session for the release review.

7. Paste externally signed transaction hex for the required roles.

8. Confirm the session moves only to:

```text
ready_for_broadcast_review
```

This status does not permit automatic broadcast.

## Evidence to Attach to the Tracking PR

Attach or summarize these artifacts:

- `artifacts/simnet/check-config.json`,
- `artifacts/simnet/probe-rpc.json`,
- `artifacts/simnet/escrow-utxos.json`,
- `artifacts/simnet/unsigned-release-preview.json`,
- `artifacts/simnet/validate-artifacts.json` if generated,
- screenshots of the transaction review and signing-session page.

Do not attach wallet files, seeds, private keys, passphrases, or real credentials.

## Failure Conditions

Stop the proof run if any of these happen:

- any endpoint is mainnet or looks like mainnet,
- a private key, seed, mnemonic, passphrase, or wallet file is requested,
- the app attempts wallet unlock,
- the app attempts app-owned signing,
- the app attempts silent broadcast,
- a release transaction can proceed without required approvals,
- a signing session reaches readiness without the required external signatures,
- artifact validation fails.

## Next Development After a Passing Run

Only after this proof passes should we build:

1. signature verification against Decred tooling,
2. a broadcast-review model,
3. operator-only explicit broadcast gating for simnet,
4. liquidation watcher queueing and alerting.

Do not add production broadcast or liquidation execution from this proof run.
