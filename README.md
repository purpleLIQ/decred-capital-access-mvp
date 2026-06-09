# Decred Capital Access MVP

A Decred-native lending prototype exploring how DCR holders could access native BTC, USDC, or USDT liquidity without selling their Decred.

The current app is a local-first prototype. It demonstrates the borrower flow, risk controls, transaction-review gates, external signed-hex collection, fixture signature verification, and a review-only broadcast gate using demo and fixture data. It does not use mainnet funds, real private keys, app-side Decred signing, or app-side broadcasting.

## Target Direction

The roadmap now targets the ideal product architecture while keeping unsafe capabilities behind proof gates:

- native DCR collateral,
- native BTC, USDC, and USDT borrow assets,
- no bridges,
- no app custody,
- no app-side private keys,
- supplier offers and soft-pool UX before true pooled custody,
- partial loan fulfillment,
- supplier interest only on filled amounts,
- v0 interest from supplier quote APR plus protocol, duration, and collateral-risk adjustments,
- 1% DCR platform fee included in the collateral funding transaction,
- initial 70% platform / 30% arbiter reserve fee split, configurable,
- arbiter intervention before automatic fallback liquidation,
- future automatic fallback liquidation only after oracle, policy, arbiter, verifier, watcher, transaction-template, and simnet proof gates pass,
- privacy-first evidence commitments on Decred,
- optional future public/Treasury funding request research for loans over $10,000 equivalent.

## Current Status

Current positioning:

```text
Decred-native DCR-backed lending prototype.
Simnet proof + non-custodial signing groundwork.
Not production-ready.
Not mainnet-ready.
No real funds.
No app-side signing.
No app-side broadcasting.
No production liquidation execution.
```

The app currently demonstrates non-custodial signing workflow behavior at the UI and state-machine level using fixture/sample data. It can collect externally signed transaction hex and move a session to `ready_for_broadcast_review`. The broadcast-review gate is exposed through API/UI as a stop-and-check layer with `canBroadcast: false`.

## What Works Now

- Quote creation for DCR collateral and demo borrow assets.
- Demo loan creation with a fake Decred escrow preview.
- Persistent local SQLite database at `data/demo.sqlite`.
- Loan status, repayment, release, operator, transaction-review, liquidation-review, market, docs, and signing-session screens.
- Transaction review envelopes for deposit, payout, release, and liquidation.
- `canMoveToSigning(review)` guard for transaction-review readiness.
- Standalone signing-session UI at `/signing-sessions`.
- Signing-session API route wrappers for session creation and external signature submissions.
- Fixture signature verification for sample externally signed hex.
- Broadcast-review API/UI that returns `blocked` or `manual_review` while keeping `canBroadcast: false`.
- Broadcast-review reuse so repeated creation attempts for the same signing session do not duplicate review state.
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
2. Use the Quote screen to price a DCR-backed demo loan.
3. Create a demo loan.
4. Use the Status screen to inspect escrow and activity.
5. Use Operator mode to detect collateral and approve/fund.
6. Use Tx review to generate transaction-review previews.
7. Move eligible reviews toward signing only when blockers are clear, approvals are complete, and unsigned transaction hex exists.
8. Use `/signing-sessions` to create a sample signing session.
9. Submit fixture signed hex for the required roles.
10. Confirm the session reaches `ready_for_broadcast_review`.
11. Create or load the broadcast review.
12. Treat broadcast review as a stop-and-check layer only. There is no broadcast button and no app-side broadcast path.
13. Use Repay to simulate repayment and collateral release.
14. Use Market to inspect DCR price/liquidity assumptions.
15. Use Docs to review the trust model, safety boundaries, and roadmap.

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
- Transaction-review safety model and tests.
- Signing-session state machine and external signed-hex collection.
- Fixture signature verification for sample signed hex.
- Broadcast-review decision layer with broadcasting disabled.
- Roadmap docs for supplier offers, cross-chain borrowing, evidence commitments, arbiters, and Decred-native lending infrastructure.

Fixture/demo only:

- DCR deposits.
- BTC/USDC/USDT payouts and repayments.
- Signed transaction hex used in the sample signing flow.
- Broadcast-review outputs based on fixture verification.
- Liquidation review and liquidation execution.

Not included yet:

- Real borrower wallet connection.
- Real dcrwallet/dcrd simnet signing.
- Real Decred signature verification.
- Supplier offer book and partial-fill state machine.
- Real BTC/USDC/USDT settlement watchers.
- Real DCR platform fee output verifier.
- Real evidence commitments on Decred.
- Production broadcast adapter.
- Mainnet support.

## Safety Boundaries

The app must not currently:

- sign transactions server-side,
- hold private keys,
- unlock wallets,
- import or export private keys,
- ask users for private keys, seeds, mnemonics, wallet files, passphrases, or xprvs,
- silently broadcast transactions,
- broadcast anything on mainnet,
- execute production liquidation,
- call wallet RPC from broadcast/signing UI paths,
- claim production readiness,
- claim real lending is live,
- claim mainnet readiness,
- claim trustless escrow is proven,
- claim automatic liquidation is production-ready.

## Roadmap Summary

Near-term sequence:

1. Protocol domain foundation:
   - borrow assets BTC/USDC/USDT,
   - DCR collateral asset,
   - loan requests,
   - supplier offers,
   - supplier fills,
   - supplier positions,
   - funding states,
   - interest config,
   - platform fee config.
2. Supplier offer and partial-fill state machine.
3. Platform fee and blended APR calculations.
4. Cross-chain watcher interfaces.
5. Oracle and liquidation policy scaffolding.
6. Evidence bundle and hash commitment scaffolding.
7. Decred collateral contract templates and simnet proof path.
8. Arbiter state machine.
9. Simnet-only automatic fallback liquidation.
10. Arbiter-agent Skill after evidence/API/state machine stability.
11. Public/Treasury funding request research for loans over $10,000 equivalent.

## Project Structure

```text
src/app/api/           Demo API routes
src/components/        Demo console, ops, and signing-session UI
src/lib/adapters/      Decred, DCRDEX, Kraken adapters
src/lib/               State machine, oracle, fixtures, SQLite store, review gates
src/lib/__tests__/     Unit tests
docs/                  Product, operations, risk, research, roadmap, and handoff docs
```

Key docs:

- `docs/AI_HANDOFF.md` — give-this-to-another-AI continuation brief.
- `docs/ROADMAP.md` — current roadmap and readiness gates.
- `docs/DECRED_NATIVE_LENDING_INFRA.md` — target DCR collateral infrastructure.
- `docs/LIQUIDITY_SUPPLIERS.md` — supplier offers, partial fills, and soft-pool UX.
- `docs/CROSS_CHAIN_BORROWING.md` — BTC, USDC, and USDT borrowing model.
- `docs/LIQUIDATION_AND_ARBITERS.md` — arbiter and automatic fallback liquidation plan.
- `docs/EVIDENCE_COMMITMENTS.md` — privacy-first evidence hash commitment plan.
- `docs/NON_CUSTODIAL_SIGNING.md` — external signing flow and current fixture implementation.
- `docs/SIGNING_BOUNDARY.md` — signing safety boundaries.
- `docs/SIMNET_PROOF_PLAN.md` — required simnet proof path.
- `docs/OPERATIONS.md` — operations checklist and scope-drift checks.

## Before Real Funds

Before any real funds:

- Prove DCR escrow paths in simnet using separate wallets.
- Prove real unsigned Decred transaction builders against running simnet wallets.
- Replace fixture signature verification with real Decred signature verification.
- Keep signing non-custodial and outside the app server.
- Add a broadcast adapter only after simnet/testnet proof and review gates.
- Add supplier offer, partial-fill, fee-verification, oracle, watcher, evidence, and arbiter controls.
- Prove liquidation policy, arbiter window, and automatic fallback behavior in simnet before any production execution.
- Complete security and protocol review.
- Cap early loan sizes aggressively.

## Useful Sources

- Decred RPC commands: https://docs.decred.org/wallets/cli/dcrctl-rpc-commands/
- Decred testnet: https://devdocs.decred.org/environments/testnet/
- dcrwallet RPC API: https://raw.githubusercontent.com/decred/dcrwallet/master/rpc/documentation/api.md
- DCRDEX: https://github.com/decred/dcrdex
- Kraken market data: https://docs.kraken.com/api/docs/category/rest-api/market-data/
- Cake Wallet Decred module: https://github.com/cake-tech/cake_wallet/tree/dev/cw_decred
- Liquidium SDK: https://github.com/Liquidium-Inc/liquidium-sdk
