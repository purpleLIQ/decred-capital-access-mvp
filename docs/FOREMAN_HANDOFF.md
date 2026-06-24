# Foreman Handoff

## Current Handoff: Oracle Liquidation Health Scaffold

Date: 2026-06-24
Branch: `oracle-liquidation-health-policy`

This branch adds a review-only oracle/liquidation-health scaffold for the Decred lending MVP. It is meant to help operators and future arbiters understand when DCR-backed loans are healthy, warning-level, margin-call-level, liquidation-review-eligible, or blocked by bad oracle/watcher evidence.

Important safety boundary:

- no live oracle calls,
- no app-side signing,
- no wallet unlock,
- no private-key handling,
- no broadcast,
- no mainnet path,
- no liquidation execution,
- no funds movement.

Completed in this pass:

- Added typed oracle observations and policy input for `DCR/USD`, `BTC/USD`, `USDC/USD`, and `USDT/USD`.
- Added deterministic oracle quorum, freshness, deviation, stale-data, and blocker checks.
- Added a liquidation-health evaluator that calculates LTV, collateralization, borrower warning/top-up windows, arbiter review signals, and privacy-safe evidence summaries.
- Wired new health events through the existing headless lifecycle event path.
- Reused the existing arbiter review queue path for `liquidation_health_review`, `evidence_incomplete`, and `watcher_stale_or_reorged` cases.
- Added reusable fixture/manual scenarios in `src/lib/oracle-liquidation-health-fixtures.ts`.
- Added targeted tests in `src/lib/__tests__/oracle-liquidation-health.test.ts`.
- Added ops-page health visibility and simple borrower lookup health text.
- Added `docs/ORACLE_LIQUIDATION_HEALTH.md`.

Targeted verification already passed:

```bash
npm test -- --run src/lib/__tests__/oracle-liquidation-health.test.ts
```

Result:

```text
1 test file passed
16 tests passed
```

Next Foreman should run the full checks before merge:

```bash
npm test
npm run lint
npm run build
npm run safety:check
```

Recommended next developer prompt:

```text
Audit the oracle/liquidation-health scaffold on branch oracle-liquidation-health-policy.

Confirm that the code stays review-only: no live oracle calls, no signing, no broadcast, no mainnet, no liquidation execution, and no funds movement.

Then move development forward by adding a small operator-only demo action that seeds or submits one fixture liquidation-health scenario from the ops UI. Reuse submitFixtureLiquidationHealthScenario and the existing lifecycle event API/store boundaries. Do not create a parallel state machine.

Acceptance criteria:
- operator can submit healthy, warning, margin call, liquidation eligible, stale oracle, deviated oracle, and stale watcher fixture scenarios for an existing lifecycle record,
- borrower lookup shows only simple health/action text,
- ops lifecycle page shows the detailed oracle/liquidation-health summary,
- arbiter cases are created only through the existing arbiter review queue path,
- automatic liquidation remains blocked,
- tests cover the new UI/action seam.

Run:
- npm test
- npm run lint
- npm run build
- npm run safety:check
```

---

Date: 2026-06-15
Branch: `connect-supplier-offers-to-borrower-fills`
PR: #83, `Connect supplier offers to borrower quote fills`

## Current Position

PR #83 connects the borrower quote flow to shared demo supplier offers. This is the right next product step after PR #82 because it starts tying the borrower and supplier surfaces together instead of keeping the supplier page as an isolated demo.

This branch should still be treated as demo-only:

- no real funds,
- no app-side signing,
- no wallet unlock,
- no private-key handling,
- no app-side broadcast,
- no mainnet path,
- no production liquidation execution.

## Completed In This Pass

- Added `vitest.config.mts` so Vitest resolves the same `@` alias that Next/TypeScript use.
- Fixed the PR #83 CI failure where `@/lib/supplier-demo-data` could not resolve from the supplier offer component test.
- Kept supplier offer demo state seeded from the shared supplier data helper.
- Changed the supplier page active-capacity metric so it reports matching capacity for the selected asset instead of summing BTC, USDC, and USDT as if all were USDC.
- Made borrower protocol quotes handle no matching supplier offers gracefully.
- Added tests for:
  - shared supplier offer allocation,
  - active/paused/canceled/mismatched offer filtering,
  - over-duration offer exclusion,
  - no matching active capacity,
  - borrower quote partial funding,
  - borrower quote no-liquidity/unfunded state,
  - supplier offer page selected-asset capacity display.

## Verification

Passed locally:

```bash
npm test
npm run safety:check
npm run verify:protocol
npm run simnet:fixture-proof
npm run lint
npm run build
```

Notes:

- `npm run lint` exits successfully but reports two existing warnings in `src/components/ops-dashboard.tsx` for unused imports.
- `npm run verify` is still blocked by a pre-existing `npm audit` finding in the Vite/esbuild dependency chain.
- `npm audit fix` upgrades the test tooling path to Vite 8/Rolldown. That works only cleanly with Node 20.19+ and was too broad/risky to mix into this borrower/supplier PR from a local Node 20.17 workspace.

## Foreman Instructions

Before assigning more work, confirm PR #83 CI is green after this branch is pushed. If CI fails:

- inspect whether GitHub Actions is using Node 20.19.0 as configured in `.github/workflows/verify.yml`,
- inspect `npm test` output first,
- do not start the next product PR until PR #83 is merged or consciously replaced.

Next developer prompt after PR #83 merge:

```text
Create supplier positions from accepted borrower quote fills.

Use the existing protocol helpers for supplier fills and positions. Add a borrower/supplier demo adapter that converts the accepted fills from the protocol quote into supplier position previews. Show the positions in the supplier area or ops view with supplier id, asset, principal, APR, interest due, repayment address placeholder, and status.

Keep this demo-only. Do not add real wallet custody, signing, broadcast, mainnet, or liquidation execution.

Tests:
- full funding creates one position per fill,
- each supplier earns only on its filled amount,
- partial funding does not activate positions unless explicitly accepted later,
- zero fills create no positions and show a clear waiting-for-liquidity state.

Run:
- npm test
- npm run verify:protocol
- npm run lint
- npm run build
```

Recommended follow-up after supplier positions:

```text
Add repayment allocation preview across supplier positions.

Use pro-rata allocation for v0. Show principal, interest, total due, repayment received, remaining due, and supplier share. Keep this as deterministic demo math first, then wire it to persistent demo state later.
```

## Open Product Threads

- Supplier offers/fills/positions are still demo data, not persistent account-backed liquidity.
- Borrower quote now sees shared offers, but create-loan still needs lifecycle integration with accepted fills.
- Repayment allocation is the next major borrower/supplier integration step.
- Watcher-backed collateral, fee-output, disbursement, repayment, and release status should wait until the product lifecycle is coherent.
- Evidence commitments currently use SHA-256 in code while docs mention Decred-oriented blake256/Merkle options. Schedule this as a deliberate protocol decision later.
- Ticket collateral remains research-only; existing staking tickets should not increase v1 borrow capacity.
- Cake Wallet remains a useful Decred mobile wallet integration reference, not a lending backend.
