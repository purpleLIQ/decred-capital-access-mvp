# Simnet Proof Plan

Simnet is the first real-network proof target. It should be isolated, repeatable, and use separate borrower, lender, and arbiter wallets.

See `docs/SIMNET_RUNBOOK.md` for the current local runbook and proof harness commands.

## Current Status

The project currently has:

- simnet RPC configuration checks,
- read-only wallet RPC probing,
- escrow UTXO inspection,
- unsigned transaction preview artifact generation,
- offline artifact validation,
- fixture proof artifact generation,
- transaction-review handoff rules,
- signing-session UI and external signed-hex collection,
- fixture signature verification,
- a broadcast-review gate that keeps `canBroadcast: false`.

The fixture proof creates local JSON artifacts only. It does not prove a real simnet transaction path and must not be described as real simnet proof.

## Decred Setup

- Run isolated simnet first.
- Use testnet only after simnet success.
- Create separate borrower, lender, and arbiter wallets.
- Keep wallet RPC credentials in environment variables.
- Do not store private keys server-side.
- Do not put wallet seeds, mnemonics, passphrases, wallet files, or xprvs in app config.
- Do not enable mainnet defaults.

## Wallet RPC Environment

Simnet RPC stays disabled until `DCR_SIMNET_ENABLED=true` is set. A complete local proof needs:

- isolated `DCRD_SIMNET_RPC_*` values,
- separate `DCRWALLET_SIMNET_BORROWER_*` values,
- separate `DCRWALLET_SIMNET_LENDER_*` values,
- separate `DCRWALLET_SIMNET_ARBITER_*` values.

The app may read RPC URLs, usernames, certificate paths, and password environment variable names. It must not commit credentials, store private keys, sign transactions, unlock wallets, or broadcast from the app-owned server process.

## Harness Commands

Check configuration without making RPC calls:

```bash
npm run simnet:check-config
```

Probe read-only wallet RPC reachability:

```bash
npm run simnet:probe-rpc
```

Inspect configured escrow UTXOs:

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

Run fixture-only proof artifact generation:

```bash
npm run simnet:fixture-proof
```

The harness is restricted to config checks, read-only wallet calls, unsigned transaction construction, and local artifact validation. It does not unlock wallets, sign, broadcast, import keys, export keys, or execute liquidation.

## Required Proof Flows

1. Create loan quote.
2. Create loan.
3. Generate escrow preview.
4. Build multisig escrow on simnet.
5. Deposit DCR collateral.
6. Detect sufficient confirmations.
7. Approve and fund loan.
8. Detect repayment.
9. Generate collateral release transaction review.
10. Collect required approvals.
11. Build unsigned release preview from real simnet UTXO data.
12. Create signing session from the ready review.
13. Collect external borrower/lender or lender/arbiter signed hex.
14. Run real Decred signature verification when implemented.
15. Run broadcast review.
16. Keep broadcast disabled until a later explicit simnet-only broadcast proof is approved.
17. Confirm all events and audit trail.
18. Trigger margin warning.
19. Evaluate liquidation policy.
20. Generate liquidation transaction review.
21. Queue liquidation review only if oracle, depth, slippage, and grace-period gates pass.
22. Do not execute liquidation from the app.

## Required Automated Liquidation Proof

Production must not require manual liquidation memory. The simnet plan must prove guarded automation:

- liquidation watcher job,
- loan risk re-evaluation cadence,
- oracle health gate,
- DEX/exchange depth gate,
- slippage gate,
- grace period tracking,
- borrower warning notification,
- automated queueing of liquidation transaction review,
- signing/broadcast boundary,
- failure alerts,
- retry behavior,
- audit trail,
- circuit breaker if oracle or DEX conditions degrade.

This proof is review/queue/alert/circuit-break work. It is not liquidation execution.

## Proof Artifacts

- Simnet environment setup command.
- Wallet creation notes.
- Environment variable template.
- `npm run simnet:check-config` output.
- `npm run simnet:probe-rpc` output.
- `npm run simnet:inspect-escrow-utxos` output.
- `npm run simnet:build-unsigned-preview` output.
- `npm run simnet:validate-artifacts` output.
- `npm run simnet:fixture-proof` output, clearly labeled fixture-only.
- Escrow transaction IDs when real simnet proof exists.
- Review envelope snapshots.
- Signing-session snapshots.
- Broadcast-review snapshots.
- Signature verification notes.
- Release and liquidation confirmation logs only after explicit simnet proof reaches that stage.
- Verification command output.

## Pass/Fail Rule

If a flow requires server-side private keys, wallet secrets in app config, wallet unlock from the app, silent signing, silent broadcast, liquidation execution, or a mainnet assumption, the proof fails.
