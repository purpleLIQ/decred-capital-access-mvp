# Decred Capital Access MVP

A local-first prototype for Decred-backed lending. The product idea is simple: let DCR holders explore how they might access USDC-style liquidity without selling their Decred.

This repo is intentionally handoff-ready. It demonstrates the loan flow, risk controls, transaction-review gates, external signed-hex collection, and a review-only broadcast gate using demo and fixture data. It does not use mainnet funds, real private keys, app-side Decred signing, or app-side broadcasting.

## Current Status

The app now demonstrates the non-custodial signing workflow at the UI and state-machine level using fixture/sample data. It can collect externally signed transaction hex and move a session to `ready_for_broadcast_review`. The broadcast-review gate exists as a review-only layer with broadcasting disabled.

Current positioning:

```text
Decred-native DCR-backed lending MVP prototype.
Simnet proof + non-custodial signing groundwork.
Not production-ready.
Not mainnet-ready.
No real funds.
No app-side signing.
No app-side broadcasting.
```

## What Works Now

- Quote creation for DCR collateral and USDC/USDT/BTC borrow assets.
- Demo loan creation with a fake 2-of-3 Decred escrow preview.
- Persistent local SQLite database at `data/demo.sqlite`.
- Loan status, repayment, release, operator, transaction-review, liquidation-review, market, docs, and signing-session screens.
- Transaction review envelopes for deposit, payout, release, and liquidation.
- `canMoveToSigning(review)` guard for transaction-review readiness.
- Standalone signing-session UI at `/signing-sessions`.
- Signing-session API route wrappers for session creation and external signature submissions.
- Fixture signature verification for sample externally signed hex.
- Broadcast-review gate that returns `blocked` or `manual_review` while keeping `canBroadcast: false`.
- Live market adapters for Kraken, DCRDEX, CoinGecko, and CoinPaprika where reachable.
- Seeded demo loans and events.
- Unit tests for LTV/risk logic, loan state machine, liquidation policy, adapter boundaries, API schemas, transaction review, signing collection, signing sessions, signature verification, and broadcast review.

## Quick Start

Requirements:

- Node.js 20.19+ recommended. Node 20.17 may run the app, but one lint dependency asks for 20.19+.
- npm.

Run:

```bash
npm install
npm run demo
```

Open:

```text
http://localhost:3000
```

Useful routes:

```text
http://localhost:3000/console
http://localhost:3000/signing-sessions
http://localhost:3000/ops
```

Run checks:

```bash
npm run verify
```

## Demo Flow

1. Open the app.
2. Use the Quote screen to price a DCR-backed loan.
3. Create a demo loan.
4. Use the Status screen to inspect escrow and activity.
5. Use Operator mode to detect collateral and approve/fund.
6. Use Tx review to generate transaction-review previews.
7. Move eligible reviews toward signing only when blockers are clear, approvals are complete, and unsigned transaction hex exists.
8. Use `/signing-sessions` to create a sample signing session.
9. Submit fixture signed hex for the required roles.
10. Confirm the session reaches `ready_for_broadcast_review`.
11. Treat broadcast review as manual review only. There is no broadcast button and no app-side broadcast path.
12. Use Repay to simulate repayment and collateral release.
13. Use Market to inspect DCR price/liquidity assumptions.
14. Use Docs to review the trust model, safety boundaries, and research sources.

Fixture signed hex values for the sample signing-session flow:

```text
01000000signedborrower_sample
01000000signedlender_sample
```

The fixture verifier expects submitted signed hex to start with:

```text
01000000signed
```

Real Decred signature verification is not implemented yet.

## What Is Real vs Simulated

Real:

- App structure, API routes, state machine, quote/risk math, docs, tests, and local persistence.
- Public market-data calls to Kraken, DCRDEX, CoinGecko, and CoinPaprika.
- Research-backed design for Decred 2-of-3 escrow.
- Transaction-review safety model and tests.
- Signing-session state-machine and external signed-hex collection.
- Fixture signature verification for sample signed hex.
- Broadcast-review decision layer with broadcasting disabled.

Fixture/demo only:

- DCR deposits.
- USDC payouts and repayments.
- Signed transaction hex used in the sample signing flow.
- Broadcast-review outputs based on fixture verification.
- Liquidation review and liquidation execution.

Not included yet:

- Real borrower wallet connection.
- Real dcrwallet/dcrd simnet signing.
- Real Decred signature verification.
- Production broadcast adapter.
- Mainnet support.
- Custody, legal, and compliance workflows.

## Safety Boundaries

The app must not:

- sign transactions server-side,
- hold private keys,
- unlock wallets,
- import or export private keys,
- ask users for private keys, seeds, mnemonics, wallet files, passphrases, or xprvs,
- silently broadcast transactions,
- broadcast anything on mainnet,
- execute liquidation,
- call wallet RPC from broadcast/signing UI paths,
- claim production readiness,
- claim real lending is live,
- claim mainnet readiness,
- claim trustless escrow is proven,
- claim liquidation automation is production-ready.

## Project Structure

```text
src/app/api/           Demo API routes
src/components/        Demo console, ops, and signing-session UI
src/lib/adapters/      Decred, DCRDEX, Kraken adapters
src/lib/               State machine, oracle, fixtures, SQLite store, review gates
src/lib/__tests__/     Unit tests
docs/                  Product, operations, risk, research, and handoff docs
```

Key docs:

- `docs/AI_HANDOFF.md` — give-this-to-another-AI continuation brief.
- `docs/ROADMAP.md` — current roadmap and readiness gates.
- `docs/RESEARCH.md` — source-backed research notes.
- `docs/TRANSACTION_REVIEW.md` — transaction-review boundary and readiness rules.
- `docs/NON_CUSTODIAL_SIGNING.md` — external signing flow and current fixture implementation.
- `docs/SIGNING_BOUNDARY.md` — signing safety boundaries.
- `docs/SIMNET_PROOF_PLAN.md` — required simnet proof path.
- `docs/TESTNET_READINESS.md` — testnet readiness checklist.

## Mainnet Caution

This is not production lending software. Before any real funds:

- Prove 2-of-3 DCR multisig in simnet using separate wallets.
- Prove real unsigned Decred transaction builders against running simnet wallets.
- Replace fixture signature verification with real Decred signature verification.
- Keep signing non-custodial and outside the app server.
- Add a broadcast adapter only after simnet/testnet proof and operator review gates.
- Add stronger oracle, liquidity, and liquidation controls.
- Prove liquidation watcher and review queue automation without app-side execution.
- Run legal, compliance, custody, threat-model, and external security review.
- Cap loan size aggressively.

## Useful Sources

- Decred RPC commands: https://docs.decred.org/wallets/cli/dcrctl-rpc-commands/
- Decred testnet: https://devdocs.decred.org/environments/testnet/
- dcrwallet RPC API: https://raw.githubusercontent.com/decred/dcrwallet/master/rpc/documentation/api.md
- DCRDEX: https://github.com/decred/dcrdex
- Kraken market data: https://docs.kraken.com/api/docs/category/rest-api/market-data/
- Cake Wallet Decred module: https://github.com/cake-tech/cake_wallet/tree/dev/cw_decred
- Liquidium SDK: https://github.com/Liquidium-Inc/liquidium-sdk
