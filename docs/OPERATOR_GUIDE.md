# Operator Guide

The operator role exists because the current MVP is review-gated and trust-minimized, not fully automated or trustless.

Operators coordinate reviews, check blockers, and keep the audit trail clear. Operators must not use the app as a signing wallet, a private-key store, or a broadcast engine.

## Responsibilities

- Confirm demo DCR collateral deposit state.
- Confirm demo USDC payout state.
- Monitor LTV and price-source health.
- Decide when a loan needs a margin warning or liquidation review.
- Review transaction blockers and required approvals.
- Coordinate borrower/lender/arbiter external signatures.
- Review signing-session status and missing roles.
- Review broadcast-review results when exposed through API/UI.
- Keep audit logs current.
- Escalate oracle, liquidity, stuck-review, or stale-session issues.

## Demo Actions

- Detect collateral: simulates a DCR deposit reaching the required confirmation threshold.
- Approve/fund: simulates operator approval and USDC payout.
- Margin warning: moves a loan into borrower attention.
- Liquidation review: moves a loan into review-gated liquidation workflow.
- Default: marks a missed-remediation loan as defaulted.
- Complete liquidation: simulates liquidation progress only. It is not real liquidation execution.

## Transaction Review Duties

Before a transaction review can move toward signing, confirm:

- review status is `ready_for_signing`,
- blockers are empty,
- required approvals are present,
- unsigned raw transaction hex exists,
- server signing is disabled,
- server broadcast is disabled,
- server private-key storage is disabled.

Do not approve a review if the app asks for wallet secrets, attempts wallet unlock, or attempts to sign/broadcast.

## Signing Session Duties

The signing-session UI is available at:

```text
/signing-sessions
```

Operators may use it to:

- create or inspect a signing session,
- confirm required signing roles,
- confirm external signed-hex submissions,
- identify missing roles,
- confirm a complete session reaches `ready_for_broadcast_review`.

The current sample flow uses fixture signed hex only. It does not prove real Decred signatures.

## Broadcast Review Duties

The broadcast-review gate currently exists as a pure library layer. Once exposed through API/UI, operators should treat it as a manual review stop, not permission to broadcast.

A safe current broadcast review must keep:

```text
canBroadcast: false
```

Any result that enables broadcast before explicit simnet/testnet proof should be treated as a failure.

## Production Requirements

Before real funds or public testnet work:

- Separate signing devices.
- Real Decred signature verification.
- Written liquidation policy.
- Emergency pause process.
- Monitoring for transaction reviews, signing sessions, broadcast reviews, price sources, and liquidation watcher health.
- Confirmed legal/compliance posture.
- Conservative loan caps.
- Clear user disclosure that the system is not trustless unless future proof supports that claim.

## Operator Safety Rules

Do not:

- request or store private keys,
- request or store seeds or mnemonics,
- request or store wallet files,
- request or store wallet passphrases,
- request or store xprvs,
- unlock wallets through the app,
- sign through the app server,
- silently broadcast,
- execute liquidation through the app,
- describe fixture signatures as real Decred signatures,
- describe the product as production-ready or mainnet-ready.
