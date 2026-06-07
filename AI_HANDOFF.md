# AI Handoff

You are continuing a Decred-native lending app. The user is non-technical and wants a working, handoff-ready project that can eventually become a profit-generating Decred tool.

Repository: `https://github.com/purpleLIQ/decred-capital-access-mvp`

Current branch: `production/transaction-review-model`

Run:

```bash
npm install
npm run demo
```

Verify:

```bash
npm run verify
```

## Current State

- Next.js + TypeScript app.
- Demo-only local app with persistent SQLite via `sql.js`.
- No mainnet funds, no real keys, no real DCR signing.
- Live market data is best-effort and safely falls back to seeded demo values.
- Borrower UI: `src/components/borrow-flow.tsx`.
- Operator console: `src/components/demo-console.tsx`.
- Ops dashboard: `src/components/ops-dashboard.tsx`.
- Core behavior:
  - `src/lib/loan-state-machine.ts`
  - `src/lib/risk.ts`
  - `src/lib/price-oracle.ts`
  - `src/lib/demo-db.ts`
  - `src/lib/liquidation-policy.ts`
  - `src/lib/transaction-review.ts`
  - `src/lib/adapters/*`

## Completed On This Branch

- Transaction review envelope model.
- Approval state model for borrower, lender, arbiter, and operator.
- `canMoveToSigning(review)` guard.
- `POST /api/transaction-review`.
- Console transaction-review tab.
- Blocked demo and simnet review generation.
- Liquidation review integration with liquidation policy blockers.
- Safety tests for schema validation, adapters, liquidation policy, state machine, and transaction review.
- Docs:
  - `docs/TRANSACTION_REVIEW.md`
  - `docs/SIMNET_PROOF_PLAN.md`
  - `docs/TESTNET_READINESS.md`
  - `docs/SIGNING_BOUNDARY.md`

## Current Transaction Review Status

Transaction reviews are previews only. Demo and simnet reviews are blocked because:

- no wallet RPC connection exists,
- no unsigned transaction builder exists,
- no raw transaction hex is produced,
- no server-side signing is allowed,
- no broadcast path exists.

The review can move to signing only when status is `ready_for_signing`, blockers are empty, required approvals are true, unsigned raw transaction hex exists, and server signing/broadcast/private-key storage remain disabled.

## Safety Rules

- Do not add mainnet signing.
- Do not store private keys server-side.
- Do not add silent transaction broadcasting.
- Do not add real liquidation execution until simnet/testnet proves the path.
- Do not imply production readiness until tests and docs support the claim.
- Production must not rely on manual liquidations.
- Automation may evaluate, queue, prepare, alert, retry, and circuit-break. Real signing and broadcast stay gated.

## Next Best Work

1. Build a simnet harness with isolated `dcrd`, three `dcrwallet` instances, and `dcrctl`.
2. Add wallet RPC environment config with no mainnet defaults.
3. Implement simnet-only unsigned transaction builders for release and liquidation.
4. Display exact inputs, outputs, fees, redeem scripts, and transaction IDs in review envelopes.
5. Add non-custodial signing flow with borrower/lender/arbiter separation.
6. Add a liquidation watcher job that queues transaction reviews automatically.
7. Add notification and alert paths for warnings, failed jobs, stuck reviews, and degraded oracle/DEX state.
8. Move from local SQLite to production database only after simnet proof.
9. Add fee ledger and revenue/accounting dashboard.
10. Do legal, threat-model, custody, and external security review before any real-money launch.

## Recommended Next Branches

- `production/simnet-wallet-rpc-config`
- `production/unsigned-transaction-builder`
- `production/liquidation-watcher`
- `production/revenue-ledger`

## Do Not Claim Yet

- Real simnet escrow proven.
- Testnet proven.
- Mainnet ready.
- Trustless lending.
- Real signing support.
- Real liquidation execution.
- Production deployment.
- Legal/compliance clearance.
