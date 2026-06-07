# Simnet Proof Plan

Simnet is the first real-network proof target. It should be isolated, repeatable, and use separate borrower, lender, and arbiter wallets.

## Decred Setup

- Run isolated simnet first.
- Use testnet only after simnet success.
- Create separate borrower, lender, and arbiter wallets.
- Keep wallet RPC credentials in environment variables.
- Do not store private keys server-side.
- Do not enable mainnet defaults.

## Wallet RPC Environment

Simnet RPC stays disabled until `DCR_SIMNET_ENABLED=true` is set. A complete local proof needs:

- isolated `DCRD_SIMNET_RPC_*` values,
- separate `DCRWALLET_SIMNET_BORROWER_*` values,
- separate `DCRWALLET_SIMNET_LENDER_*` values,
- separate `DCRWALLET_SIMNET_ARBITER_*` values.

The app may read RPC URLs, usernames, certificate paths, and password environment variable names. It must not commit credentials, store private keys, sign transactions, or broadcast from the app-owned server process.

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
10. Collect required approvals and signatures.
11. Broadcast release on simnet.
12. Confirm collateral release.
13. Trigger margin warning.
14. Evaluate liquidation policy.
15. Generate liquidation transaction review.
16. Execute simulated/testnet liquidation only if oracle, depth, slippage, and grace period pass.
17. Confirm all events and audit trail.

## Required Automated Liquidation Proof

Production must not require manual liquidation. The simnet plan must prove guarded automation:

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

## Proof Artifacts

- Simnet environment setup command.
- Wallet creation notes.
- Environment variable template.
- Escrow transaction IDs.
- Review envelope snapshots.
- Signature collection notes.
- Broadcast transaction IDs.
- Release and liquidation confirmation logs.
- Verification command output.

## Pass/Fail Rule

If a flow requires server-side private keys, silent signing, silent broadcast, or a mainnet assumption, the proof fails.
