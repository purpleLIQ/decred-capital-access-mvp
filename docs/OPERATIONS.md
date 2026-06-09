# Operations Checklist

This app is still demo-first, but these checks make the path to a hosted alpha cleaner.

## Local Verification

Run before merging any code change:

```bash
npm run verify
```

This runs dependency audit, unit tests, lint, and production build.

For docs-only changes, verification may be skipped if the PR clearly changes only Markdown files. Say so in the PR body when skipped.

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
3. Run `npm run verify` locally for code changes.
4. Merge only after verification passes or after a docs-only skip is clearly stated.
5. Keep `docs/AI_HANDOFF.md`, `README.md`, and relevant docs current when behavior changes.

## Production Gates

Do not move toward real funds until all of these are complete:

- Simnet 2-of-3 borrower/lender/arbiter escrow proven.
- Transaction review screen and readiness guards in place.
- Signing-session flow proven without app-side signing.
- Real Decred signature verification implemented and proven.
- Broadcast-review gate exposed and proven while keeping unsafe broadcast disabled.
- No private keys stored server-side or in SQLite.
- No wallet passphrases, seeds, mnemonics, wallet files, or xprvs collected by the app.
- Oracle degradation behavior blocks automated loan activation.
- Liquidation watcher queues review automatically when thresholds are crossed.
- Transaction reviews, signing sessions, and broadcast reviews are monitored for stuck or failed states.
- Signing and broadcast are still separated from app-owned server custody.
- Legal/compliance review completed for target launch regions.

## Transaction Review Operations

The console can generate transaction reviews for collateral deposit, payout, release, and liquidation. Reviews are operational evidence and readiness checks, not signed transactions.

Monitor:

- pending transaction reviews,
- blocker reasons,
- missing approval roles,
- liquidation policy blockers,
- failed review generation,
- stale review age,
- review-to-signing attempts.

Any review that reaches `ready_for_signing` must still be signed outside the app-owned server process.

## Signing Session Operations

The standalone signing-session UI is available at:

```text
/signing-sessions
```

Current signing-session operations are fixture/demo-level. Operators may use the sample flow to confirm that the app can:

- create a signing session,
- show required signing roles,
- collect borrower/lender or lender/arbiter signed-hex submissions,
- reject unsafe/private-key-like submission fields,
- reject unsigned raw transaction hex submitted as signed hex,
- move a complete session to `ready_for_broadcast_review`.

The current fixture signed hex prefix is:

```text
01000000signed
```

This does not prove real Decred signatures.

## Broadcast Review Operations

The broadcast-review gate is exposed through:

```text
/api/broadcast-reviews
```

and through the signing-session UI:

```text
/signing-sessions
```

The gate may return:

- `blocked`
- `manual_review`

It must keep:

```text
canBroadcast: false
```

Operator review should treat broadcast review as a stop-and-check layer, not permission to broadcast. There is no broadcast button, no production broadcast adapter, and no mainnet broadcast path.

Repeated creation attempts for the same signing session should reuse the existing broadcast review instead of creating duplicate review state.

Monitor:

- sessions ready for broadcast review,
- blocked broadcast reviews,
- manual-review decisions,
- fixture signature verification failures,
- missing operator approval,
- stale broadcast-review state.

## Liquidation Operations

Liquidation automation is not execution.

Allowed liquidation automation behavior:

- evaluate risk,
- warn,
- queue reviews,
- alert operators,
- retry failed jobs,
- trigger circuit breakers.

Not allowed:

- app-side signing,
- app-side broadcasting,
- wallet unlock,
- liquidation execution,
- mainnet liquidation.
