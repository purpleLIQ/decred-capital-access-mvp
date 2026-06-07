# Testnet Readiness

The app is not testnet-ready yet. It has a safe review boundary that prepares the codebase for simnet work first.

## Required Order

1. Prove everything on isolated Decred simnet.
2. Move to Decred testnet only after simnet deposit, payout, repayment, release, liquidation review, and audit trail pass.
3. Keep mainnet disabled until testnet has run with monitoring and operational review.

## Network Rules

- No mainnet defaults.
- Separate borrower, lender, and arbiter wallets.
- No server-side private key storage.
- Wallet RPC credentials must live in environment variables.
- RPC credentials must not be committed.
- Signing and broadcast remain gated behind explicit review.

## Required Testnet Prerequisites

- Simnet `dcrd` and three `dcrwallet` instances documented.
- Real 2-of-3 multisig escrow built on simnet.
- Collateral deposit watcher with confirmation threshold.
- Unsigned release transaction builder.
- Unsigned liquidation transaction builder.
- Transaction review screen showing exact inputs, outputs, fees, blockers, and approvals.
- Non-custodial signing path.
- Broadcast only after signed transaction validation and explicit operator action.
- Audit trail for every review, signature, broadcast, and confirmation.

## Required Monitoring Before Testnet

- `/api/health` status.
- Oracle status.
- Liquidation watcher heartbeat.
- Pending transaction review count.
- Failed automation alerts.
- Stuck loan alerts.
- Stale database/job heartbeat.
- Fee collection and accounting metrics.

## Testnet Exit Criteria

The app may be considered ready for a capped mainnet-alpha design only after testnet proves:

- deposit detection,
- payout gating,
- repayment detection,
- release transaction review,
- signature collection,
- broadcast,
- collateral release confirmation,
- margin warning,
- liquidation policy evaluation,
- liquidation transaction review,
- failure alerts,
- retry behavior,
- circuit breaker behavior,
- complete audit trail.
