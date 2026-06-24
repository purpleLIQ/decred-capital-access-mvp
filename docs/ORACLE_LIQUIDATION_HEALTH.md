# Oracle Liquidation Health Scaffold

Date: 2026-06-24
Branch: `oracle-liquidation-health-policy`

## What Exists

This pass adds a production-shaped, review-only oracle and liquidation-health scaffold.

Core files:

- `src/lib/oracle-liquidation-health.ts`
- `src/lib/oracle-liquidation-health-fixtures.ts`
- `src/lib/headless-lifecycle-events.ts`
- `src/lib/headless-lifecycle-transitions.ts`
- `src/lib/arbiter-review-cases.ts`
- `src/components/ops-lifecycle-records.tsx`
- `src/components/headless-borrower-lifecycle.tsx`

The policy accepts typed oracle observations for:

- `DCR/USD`
- `BTC/USD`
- `USDC/USD`
- `USDT/USD`

It produces:

- selected DCR/USD and borrow-asset/USD prices,
- oracle freshness/deviation/quorum status,
- LTV and collateralization,
- health status,
- borrower warning/top-up window state,
- privacy-safe evidence summary,
- arbiter review signal.

## Safety Boundary

This scaffold does not:

- call live oracle providers,
- sign transactions,
- broadcast transactions,
- execute liquidations,
- move funds,
- touch mainnet.

Automatic liquidation remains explicitly blocked in the health result and lifecycle summary.

## Fixture Scenarios

The reusable fixture helper covers:

- `healthy_loan`
- `warning_state`
- `margin_call_state`
- `liquidation_eligible_state`
- `stale_oracle`
- `deviated_oracle`
- `stale_watcher`
- `borrower_warning_opened`
- `top_up_requested`
- `arbiter_review_case_opened`
- `evidence_summary_prepared`

Use `createFixtureLiquidationHealthScenario` for pure policy output.

Use `submitFixtureLiquidationHealthScenario` to submit generated events through the lifecycle API and derive arbiter review cases through the existing queue path.

## UX

Borrower lookup now shows a simple loan-health summary and safe next action.

Ops lifecycle records now show oracle/liquidation-health details, including:

- health status,
- LTV,
- collateral value,
- debt value,
- selected DCR/USD,
- oracle quorum/deviation/usability,
- borrower warning/top-up status,
- blocker reason,
- execution-blocked badge.

## Verification

Targeted test:

```bash
npm test -- --run src/lib/__tests__/oracle-liquidation-health.test.ts
```

Expected result from this pass:

```text
1 test file passed
16 tests passed
```

Run the full project checks before merge:

```bash
npm test
npm run lint
npm run build
npm run safety:check
```

## Next Foreman Prompt

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

## Production Gaps

- Replace fixture/manual oracle observations with audited provider adapters.
- Decide conservative price selection rules for low-liquidity DCR markets.
- Add live provider health monitoring and alerting.
- Persist warning/top-up deadlines in durable storage with retryable notification jobs.
- Build top-up watcher support before recognizing top-ups.
- Connect evidence summaries to a timestampable evidence bundle workflow.
- Prove any liquidation path on simnet/testnet before mainnet discussion.
- Keep legal, security, and operational review gates before production lending.
