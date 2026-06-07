# Simnet Proof Runbook

This runbook is for the first real-network proof path. It is intentionally limited to configuration checks and read-only/unsigned RPC probing.

## Boundary

Allowed in this phase:

- start isolated local simnet services,
- configure `dcrd` and separate borrower/lender/arbiter `dcrwallet` RPC endpoints,
- verify required environment variables,
- probe wallet RPC reachability with `listunspent`,
- inspect whether escrow UTXOs exist.

Not allowed in this phase:

- server-side private-key storage,
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

Start from `.env.example` and set only local simnet values:

```bash
DCR_SIMNET_ENABLED=true

DCRD_SIMNET_RPC_URL=http://127.0.0.1:19556
DCRD_SIMNET_RPC_USER=...
DCRD_SIMNET_RPC_PASSWORD=...
DCRD_SIMNET_RPC_CERT_PATH=...

DCRWALLET_SIMNET_BORROWER_RPC_URL=http://127.0.0.1:19557
DCRWALLET_SIMNET_BORROWER_RPC_USER=...
DCRWALLET_SIMNET_BORROWER_RPC_PASSWORD=...
DCRWALLET_SIMNET_BORROWER_RPC_CERT_PATH=...
DCRWALLET_SIMNET_BORROWER_ACCOUNT=...

DCRWALLET_SIMNET_LENDER_RPC_URL=http://127.0.0.1:19558
DCRWALLET_SIMNET_LENDER_RPC_USER=...
DCRWALLET_SIMNET_LENDER_RPC_PASSWORD=...
DCRWALLET_SIMNET_LENDER_RPC_CERT_PATH=...
DCRWALLET_SIMNET_LENDER_ACCOUNT=...

DCRWALLET_SIMNET_ARBITER_RPC_URL=http://127.0.0.1:19559
DCRWALLET_SIMNET_ARBITER_RPC_USER=...
DCRWALLET_SIMNET_ARBITER_RPC_PASSWORD=...
DCRWALLET_SIMNET_ARBITER_RPC_CERT_PATH=...
DCRWALLET_SIMNET_ARBITER_ACCOUNT=...
```

Do not commit a populated `.env` file.

## Harness Commands

Check required config without making RPC calls:

```bash
npm run simnet:check-config
```

Probe wallet RPC reachability using read-only wallet calls:

```bash
npm run simnet:probe-rpc
```

Run the normal project verification suite:

```bash
npm run verify
```

## Proof Artifacts To Capture

Capture these in a local proof log or PR comment when simnet is running:

- `npm run simnet:check-config` output,
- `npm run simnet:probe-rpc` output,
- wallet role mapping,
- escrow address used for the test loan,
- UTXO count and confirmation status,
- unsigned review envelope snapshot once raw transaction preview is proven,
- any blocker output.

## Pass/Fail Rule

The proof fails if any step requires server-side private keys, wallet unlock from this app, signing RPC calls, silent broadcast, liquidation execution, or a mainnet assumption.
