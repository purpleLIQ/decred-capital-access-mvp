# Operations Checklist

This app is still demo-first, but these checks make the path to a hosted alpha cleaner.

## Local Verification

Run before merging any code change:

```bash
npm run verify
```

This runs dependency audit, unit tests, lint, and production build.

## Health Endpoint

The app exposes a health endpoint:

```text
/api/health
```

It returns:

- `status`: `ok` or `degraded`
- `demoMode`: whether the app is in demo-safe mode
- oracle health
- price-source count
- database readability
- loan counts by status
- current market snapshot
- guardrails that should remain true before mainnet work

A degraded response is expected if fewer than the configured minimum live DCR/USD price sources respond. In demo mode, this should block automated production assumptions but not local demos.

## Merge Routine

1. Work on a branch.
2. Open a focused PR.
3. Run `npm run verify` locally.
4. Merge only after verification passes.
5. Keep `AI_HANDOFF.md`, `README.md`, and relevant docs current when behavior changes.

## Production Gates

Do not move toward real funds until all of these are complete:

- Simnet 2-of-3 borrower/lender/arbiter escrow proven.
- Transaction review screen added before signing.
- No private keys stored server-side or in SQLite.
- Oracle degradation behavior blocks automated loan activation.
- Liquidation watcher queues review automatically when thresholds are crossed.
- Transaction reviews are monitored for stuck or failed states.
- Signing and broadcast are still separated from app-owned server custody.
- Legal/compliance review completed for target launch regions.

## Transaction Review Operations

The console can generate blocked transaction reviews for collateral deposit, payout, release, and liquidation. Reviews are operational evidence, not signed transactions.

Monitor:

- pending transaction reviews,
- blocker reasons,
- missing approval roles,
- liquidation policy blockers,
- failed review generation,
- stale review age,
- review-to-signing attempts.

Any review that reaches `ready_for_signing` in a future simnet branch must still be signed outside the app-owned server process.
