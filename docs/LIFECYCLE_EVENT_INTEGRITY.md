# Lifecycle Event Integrity Gate

Date: 2026-06-25
Branch: `lifecycle-event-integrity-v2`

## What Exists

This branch adds a central integrity gate around `submitHeadlessLifecycleEvent(...)`.

The gate lives in:

- `src/lib/lifecycle-event-integrity.ts`

It is wired through:

- `src/lib/headless-lifecycle-event-api.ts`
- `src/lib/lifecycle-event-store.ts`
- `src/lib/headless-lifecycle-events.ts`
- `src/components/lifecycle-event-history.tsx`

The goal is to stop duplicate, replayed, stale, out-of-order, contradictory, or unsafe lifecycle events before they mutate a headless loan record.

## Integrity Statuses

Typed statuses:

- `accepted`
- `duplicate`
- `replayed`
- `stale`
- `out_of_order`
- `unsafe_transition`
- `contradictory`
- `missing_required_context`
- `needs_manual_review`

The API returns integrity metadata with:

- event id,
- lookup code,
- status,
- applied true/false,
- reason,
- audit note,
- affected lifecycle section,
- previous/next status summary,
- manual review recommendation.

## Covered Checks

Implemented protections:

- duplicate event id cannot apply twice,
- duplicate watcher event id cannot apply twice for the same event kind,
- duplicate oracle/health result id cannot apply twice for the same event kind,
- duplicate arbiter decision id cannot apply twice for the same event kind,
- stale watcher event cannot overwrite newer progressed lifecycle state,
- stale oracle/liquidation-health result cannot make a loan look safer,
- repayment mismatch cannot mark repayment complete,
- older partial repayment cannot roll back full repayment,
- older arbiter review request cannot reopen a resolved review,
- liquidation review cannot imply liquidation execution readiness.

Blocked/no-op events with unique ids are stored with integrity metadata so ops can see what happened. Exact duplicate event ids are returned as no-op results without replacing the original accepted event.

## Ops Visibility

`src/components/lifecycle-event-history.tsx` now shows:

- integrity status,
- applied/no-op,
- prior matching event id,
- manual review recommendation,
- integrity reason,
- integrity audit note.

Borrower lookup remains unchanged.

## Safety Boundary

This branch does not add:

- live oracle providers,
- Decred/BTC/EVM RPC calls,
- wallet integration,
- private key handling,
- seed/mnemonic/passphrase collection,
- wallet unlock,
- signing,
- broadcast,
- mainnet broadcast,
- liquidation transaction creation,
- liquidation execution,
- real fund movement,
- arbiter payout automation.

## Verification

Passed locally:

```bash
npm run verify
npm run verify:protocol
npm test
npm run lint
npm run build
npm run safety:check
```

`npm run lint` exits successfully with 13 pre-existing warnings in older files.

## Next Prompt

```text
Review branch lifecycle-event-integrity-v2 for the central lifecycle event integrity gate.

Confirm the gate is wired only around submitHeadlessLifecycleEvent and does not create a parallel lifecycle system. Check that duplicate/replay/stale/unsafe events no-op before mutation, that ops event history shows integrity status, and that no wallet/signing/broadcast/mainnet/liquidation execution/funds movement was added.

If continuing development, add a narrow follow-up that records a formal manual-review case when integrity returns needs_manual_review or unsafe_transition, reusing the existing arbiter review queue. Do not create a new review system.

Run:
- npm run verify
```
