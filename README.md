# Decred Capital Access MVP

A local-first demo of a Decred-backed lending app. The product idea is simple: let DCR holders access USDC-style liquidity without selling their Decred.

This repo is intentionally beginner-friendly and handoff-ready. Demo mode does not use mainnet funds, real private keys, or live Decred signing. It shows the loan flow, risk controls, market integrations, and the staged path toward a real 2-of-3 Decred multisig alpha.

## What Works Now

- Quote creation for DCR collateral and USDC/USDT/BTC borrow assets.
- Demo loan creation with a fake 2-of-3 Decred escrow preview.
- Persistent local SQLite database at `data/demo.sqlite`.
- Loan status, repayment, release, operator, transaction-review, liquidation-review, market, and docs screens.
- Blocked transaction review envelopes for deposit, payout, release, and liquidation.
- Live market adapters for Kraken, DCRDEX, CoinGecko, and CoinPaprika where reachable.
- Seeded demo loans and events.
- Unit tests for LTV/risk logic, loan state machine, liquidation policy, adapter boundaries, API schemas, and transaction review.

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
6. Use Tx review to generate blocked review previews before any future signing work.
7. Use Repay to simulate repayment and collateral release.
8. Use Market to inspect DCR price/liquidity assumptions.
9. Use Docs to review the trust model and research sources.

## What Is Real vs Simulated

Real:

- App structure, API routes, state machine, quote/risk math, docs, tests, local persistence.
- Public market-data calls to Kraken, DCRDEX, CoinGecko, and CoinPaprika.
- Research-backed design for Decred 2-of-3 escrow.
- Transaction-review safety model and tests proving demo/simnet reviews remain blocked.

Simulated:

- DCR deposits.
- USDC payouts and repayments.
- Decred transaction signing and broadcasting.
- Liquidation execution.

Not included yet:

- Real borrower wallet connection.
- Real dcrwallet/dcrd simnet signing.
- Real unsigned Decred transaction builder.
- Mainnet support.
- Custody/legal/compliance workflows.

## Project Structure

```text
src/app/api/           Demo API routes
src/components/        Demo console UI
src/lib/adapters/      Decred, DCRDEX, Kraken adapters
src/lib/               State machine, oracle, fixtures, SQLite store
src/lib/__tests__/     Unit tests
docs/                  Product, operations, risk, research, and handoff docs
```

Key docs:

- `docs/AI_HANDOFF.md` — give-this-to-another-AI continuation brief.
- `docs/ROADMAP.md` — Phase 1 through Phase 7 production-readiness plan.
- `docs/RESEARCH.md` — source-backed research notes.
- `docs/TRANSACTION_REVIEW.md` — transaction-review boundary and readiness rules.
- `docs/SIMNET_PROOF_PLAN.md` — required simnet proof path.
- `docs/TESTNET_READINESS.md` — testnet readiness checklist.

## Mainnet Caution

This is not production lending software. Before any real funds:

- Prove 2-of-3 DCR multisig in simnet using separate wallets.
- Add simnet unsigned transaction builders.
- Add authenticated non-custodial signing workflows.
- Add secure key custody procedures.
- Add stronger oracle and liquidation controls.
- Prove liquidation watcher and review queue automation.
- Run legal/compliance review.
- Cap loan size aggressively.

## Useful Sources

- Decred RPC commands: https://docs.decred.org/wallets/cli/dcrctl-rpc-commands/
- Decred testnet: https://devdocs.decred.org/environments/testnet/
- dcrwallet RPC API: https://raw.githubusercontent.com/decred/dcrwallet/master/rpc/documentation/api.md
- DCRDEX: https://github.com/decred/dcrdex
- Kraken market data: https://docs.kraken.com/api/docs/category/rest-api/market-data/
- Cake Wallet Decred module: https://github.com/cake-tech/cake_wallet/tree/dev/cw_decred
- Liquidium SDK: https://github.com/Liquidium-Inc/liquidium-sdk
