# Operations Checklist

This app is still prototype-first, but these checks keep the path toward the ideal product controlled.

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
5. Keep `docs/AI_HANDOFF.md`, `docs/ROADMAP.md`, `README.md`, and relevant docs current when behavior changes.

## Current Prototype Gates

Do not move toward real funds until all of these are complete:

- Simnet borrower/supplier/arbiter escrow proven.
- Transaction review screen and readiness guards in place.
- Signing-session flow proven without app-side signing.
- Real Decred signature verification implemented and proven.
- Broadcast-review gate exposed and proven while keeping unsafe broadcast disabled.
- No private keys stored server-side or in SQLite.
- No wallet passphrases, seeds, mnemonics, wallet files, or xprvs collected by the app.
- Oracle degradation behavior blocks unsafe automated assumptions.
- Transaction reviews, signing sessions, and broadcast reviews are monitored for stuck or failed states.
- Signing and broadcast remain separated from app-owned server custody.
- Security and protocol review completed before real funds.

## Ideal Product Operations Tracks

The roadmap now targets:

- native DCR collateral,
- native BTC / USDC / USDT borrow assets,
- supplier offers and soft-pool UX,
- partial loan fulfillment,
- DCR platform fee output verification,
- arbiter reserve accounting,
- arbiter intervention before fallback liquidation,
- automatic fallback liquidation after simnet proof,
- privacy-first evidence hash commitments on Decred,
- optional future public/Treasury funding requests for loans over $10,000 equivalent.

These are target architecture items, not current production behavior.

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

Broadcast review is a stop-and-check layer, not permission to broadcast. There is no broadcast button, no production broadcast adapter, and no mainnet broadcast path.

Repeated creation attempts for the same signing session should reuse the existing broadcast review instead of creating duplicate review state.

Monitor:

- sessions ready for broadcast review,
- blocked broadcast reviews,
- manual-review decisions,
- fixture signature verification failures,
- missing operator approval,
- stale broadcast-review state.

## Supplier Liquidity Operations Target

Future supplier operations should track:

- supplier offers,
- paused/cancelled offers,
- partial fills,
- funding windows,
- expired reservations,
- supplier positions,
- active principal,
- earned interest,
- repayments received,
- liquidation-risk exposure.

Current repo does not yet implement this.

## Platform Fee Operations Target

Future platform fee operations should verify:

- expected DCR fee amount,
- expected platform fee address,
- expected collateral escrow output,
- borrower change rules,
- no unexpected outputs,
- 70% platform / 30% arbiter reserve accounting.

Initial fee config target:

```text
platformFeeBps = 100
platformShareBps = 7000
arbiterReserveShareBps = 3000
```

Current repo does not yet implement the final fee verifier.

## Liquidation Operations

Current liquidation automation is not execution.

Allowed current liquidation automation behavior:

- evaluate risk,
- warn,
- queue reviews,
- alert operators,
- retry failed jobs,
- trigger circuit breakers.

Not allowed currently:

- app-side signing,
- app-side broadcasting,
- wallet unlock,
- production liquidation execution,
- mainnet liquidation.

Target future liquidation behavior:

```text
oracle detects liquidation eligibility
-> borrower warning/top-up window
-> arbiter intervention window
-> automatic fallback liquidation if unresolved and all policy/verifier/simnet gates pass
```

Founder/operator manual liquidation review is not the target architecture.

Automatic fallback liquidation must remain disabled until oracle, policy, arbiter, watcher, transaction-template, evidence, and simnet proof gates pass.

## Evidence Commitment Operations Target

Future evidence operations should track:

- full participant-visible evidence bundle,
- privacy-safe public summary,
- evidence hash,
- Decred commitment transaction,
- commitment lookup,
- evidence verification status.

Full liquidation/loan evidence should not be stored on-chain. Decred should store compact commitments only.

## Scope Drift Checks

Before any PR, confirm it does not introduce:

- real funds,
- mainnet paths,
- automatic production broadcast,
- app-side signing,
- wallet unlock,
- private-key handling,
- true custody pools,
- Treasury request integration before its roadmap phase,
- arbiter-agent Skill before evidence/API stability,
- production liquidation execution.
