# Testnet Readiness

The app is not testnet-ready yet. It has safe review and signing-session boundaries that prepare the codebase for simnet work first.

## Required Order

1. Prove everything on isolated Decred simnet.
2. Move to Decred testnet only after simnet deposit, payout, repayment, release, liquidation review, signing-session, final review, and audit trail pass.
3. Keep mainnet disabled until testnet has run with monitoring, operational review, legal review, and security review.

## Network Rules

- No mainnet defaults.
- Separate borrower, lender, and arbiter wallets.
- No server-side private key storage.
- No seeds, mnemonics, wallet files, passphrases, or xprvs in app config.
- Wallet RPC credentials must live in environment variables.
- RPC credentials must not be committed.
- Signing and final network submission remain gated behind explicit review.
- Wallet RPC must not be called from signing or final-review UI paths.

## Current Prototype State

Implemented now:

- Transaction-review model and readiness guard.
- Simnet unsigned-builder scaffold.
- Signing-session UI and external signed-hex collection.
- Fixture signature verification.
- Final-review gate with `canBroadcast: false`.
- Simnet harness commands for config checks, RPC probing, UTXO inspection, unsigned preview building, artifact validation, and fixture proof.

Not implemented yet:

- Real Decred signature verification.
- Real simnet collateral release proof.
- Testnet wallet flow.
- Production network-submission adapter.
- Real liquidation execution.
- Mainnet support.

## Required Testnet Prerequisites

- Simnet `dcrd` and three `dcrwallet` instances documented.
- Real 2-of-3 multisig escrow built on simnet.
- Collateral deposit watcher with confirmation threshold.
- Unsigned release transaction builder proven on simnet.
- Unsigned liquidation transaction builder proven on simnet.
- Transaction review screen showing exact inputs, outputs, fees, blockers, and approvals.
- Non-custodial signing path.
- Real Decred signature verification.
- Final review that checks signed transaction details and still requires explicit operator action.
- Audit trail for every review, signature submission, final-review decision, network submission, and confirmation.

## Required Monitoring Before Testnet

- `/api/health` status.
- Oracle status.
- Liquidation watcher heartbeat.
- Pending transaction review count.
- Stale signing-session count.
- Final-review status count.
- Failed automation alerts.
- Stuck loan alerts.
- Stale database/job heartbeat.
- Fee collection and accounting metrics.

## Testnet Entry Criteria

The app may be considered ready for a limited testnet pilot only after simnet proves:

- deposit detection,
- payout gating,
- repayment detection,
- release transaction review,
- signature collection,
- real signature verification,
- final review,
- explicit operator-controlled testnet network-submission path,
- collateral release confirmation,
- margin warning,
- liquidation policy evaluation,
- liquidation transaction review,
- failure alerts,
- retry behavior,
- circuit breaker behavior,
- complete audit trail.

## Testnet Exit Criteria

The app may be considered ready for a capped mainnet-alpha design only after testnet proves:

- the same full flow tested on simnet,
- reliable monitoring and alerting,
- operator runbooks,
- emergency stop process,
- conservative loan caps,
- reviewed legal/compliance posture,
- reviewed custody and signing boundaries,
- external security review,
- clear user disclosures.

Mainnet remains blocked until those gates are complete.
