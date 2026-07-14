# Foreman Handoff

## Current Handoff: Repayment Guided Demo Scenario

1. **Date:** 2026-07-14
2. **Branch:** `repayment-guided-demo-scenario`
3. **PR URL, if opened:** Pending until branch push/PR creation.
4. **Latest commit SHA:** Pending until final commit; final Codex output will list the exact pushed SHA.
5. **Summary:**
   - Extended the guided operator demo scenario to support typed presets: `control_plane` and `repayment_release_readiness`.
   - Kept the existing control-plane guided scenario behavior intact.
   - Added repayment-inclusive fixture steps for full repayment observation and collateral release readiness review.
   - Routed repayment through the existing borrow-asset watcher/lifecycle event path.
   - Routed release readiness through `submitHeadlessLifecycleEvent(...)` with a review-only `collateral_release_ready` event.
   - Updated the ops panel with preset selection, repayment status, release-readiness status, proof readiness status, and a dedicated repayment preset action.
   - Updated tests and docs for the repayment/release-readiness loop.
6. **Files changed:**
   - `src/lib/guided-operator-demo-scenario.ts`
   - `src/app/api/guided-operator-demo-scenario/route.ts`
   - `src/components/guided-operator-demo-scenario-panel.tsx`
   - `src/lib/__tests__/guided-operator-demo-scenario.test.ts`
   - `src/components/__tests__/guided-operator-demo-scenario-panel.test.tsx`
   - `docs/GUIDED_OPERATOR_DEMO_SCENARIO.md`
   - `docs/FOREMAN_HANDOFF.md`
7. **Checks run:**
   - `npm test -- --run src/lib/__tests__/guided-operator-demo-scenario.test.ts src/components/__tests__/guided-operator-demo-scenario-panel.test.tsx src/components/__tests__/ops-lifecycle-records.test.tsx`
   - `npm test`
   - `npm run lint`
   - `npm run build`
   - `npm run verify`
   - `npm run verify:protocol`
   - `npm run safety:check`
   - `git diff --check`
8. **Passing checks:**
   - Focused guided scenario module/UI tests passed: 3 files, 13 tests.
   - Full test suite passed: 51 files, 282 tests.
   - Lint exited successfully.
   - Build passed.
   - Combined verify passed.
   - Protocol verify passed: 8 files, 61 tests.
   - Safety advisory check passed.
9. **Failing checks and exact errors, if any:**
   - No failing checks.
   - `npm run lint` still reports 13 pre-existing warnings in older files for unused imports/unused `_section`/`_patch` test parameters.
10. **Safety boundary:**
   - Repayment observation is fixture/review-only.
   - Release readiness is not release execution.
   - All lifecycle-affecting actions route through the existing lifecycle event API/integrity gate.
   - No live Decred/BTC/EVM/oracle RPC, wallet integration, private keys, seed/mnemonic/passphrase handling, wallet unlock, app-side signing, broadcast, mainnet, real transactions, collateral release execution, liquidation execution, real fund movement, arbiter payout automation, new lifecycle system, new event system, or new review system was added.
11. **What is complete:**
   - `control_plane` preset remains available.
   - `repayment_release_readiness` preset can progress through collateral, fee, disbursement, health, evidence, repayment, release readiness, and simnet proof readiness.
   - Simnet proof readiness can show release-precondition progress after full repayment while broadcast remains blocked.
   - Ops panel renders preset, repayment status, release-readiness status, proof status, event ids, case ids, proof session id, and hard broadcast block.
   - Borrower-safe copy stays simple and does not expose fixture/watcher/oracle/integrity/simnet/signed-hex/broadcast internals.
12. **What remains:**
   - Push branch and open PR titled `Add repayment guided demo scenario`.
   - Review whether future presets should include partial repayment, disputed repayment, or top-up paths in separate branches.
13. **Known risks/review points:**
   - The repayment preset uses one deterministic full-repayment path only.
   - Release readiness is represented by a review-only lifecycle event and must not be mistaken for release execution.
   - Simnet proof readiness can show unsigned preview readiness, but signing and broadcast remain blocked by design.
14. **Recommended next Foreman action:**
   - Review the PR for preset ergonomics and safety boundaries first.
   - Confirm repayment and release-readiness steps reuse the existing event/integrity path and do not directly mutate lifecycle records.
   - Check that the ops panel is clear enough for an internal reviewer to run the repayment-inclusive demo without reading individual modules.
15. **Recommended next developer prompt:**

```text
Review branch repayment-guided-demo-scenario and PR "Add repayment guided demo scenario".

Confirm the new repayment_release_readiness preset preserves the existing control_plane preset, routes full repayment through the borrow-asset watcher/lifecycle event path, marks collateral release readiness as review-only through submitHeadlessLifecycleEvent, refreshes simnet proof readiness after repayment/release readiness, and keeps signing, signed hex, broadcast, mainnet, collateral release execution, liquidation execution, wallet/key handling, and real fund movement blocked.

Run:
- npm run verify
- npm run verify:protocol
- npm run safety:check

Then inspect the ops lifecycle records page and verify the Guided demo scenario panel shows selected preset, repayment status, release-readiness status, proof readiness status, event ids, case ids, proof session id, Broadcast blocked, and No signing/no real funds copy.
```

---

## Current Handoff: Guided Operator Demo Scenario

1. **Date:** 2026-07-08
2. **Branch:** `guided-operator-demo-scenario`
3. **PR URL, if opened:** https://github.com/purpleLIQ/decred-capital-access-mvp/pull/100
4. **Latest commit SHA:** Implementation commit at PR creation: `138dcefa7e233ec2820e02bb14613f494a18b8ec`. The final pushed handoff-update commit SHA is listed in the final Codex output because a commit cannot contain its own hash without changing it.
5. **Summary:**
   - Added a deterministic operator-only guided demo scenario across the existing lifecycle, watcher, oracle-health, arbiter-review, and simnet proof readiness seams.
   - Added pure planning/status helpers for guided demo scenario state.
   - Added an operator API route to read scenario status, run the next safe fixture step, run the full safe demo, refresh status, or seed a demo lifecycle record.
   - Added an ops lifecycle-record panel showing phase, completed steps, next safe action, emitted event ids, review case ids, proof session id, and hard broadcast block.
   - Added focused tests for planning, sequencing, orchestration, idempotency, borrower-safe status, UI rendering, and safety boundaries.
   - Added a concise practical doc for the guided operator demo scenario.
6. **Files changed:**
   - `src/lib/guided-operator-demo-scenario.ts`
   - `src/app/api/guided-operator-demo-scenario/route.ts`
   - `src/components/guided-operator-demo-scenario-panel.tsx`
   - `src/components/ops-lifecycle-records.tsx`
   - `src/lib/__tests__/guided-operator-demo-scenario.test.ts`
   - `src/components/__tests__/guided-operator-demo-scenario-panel.test.tsx`
   - `src/components/__tests__/ops-lifecycle-records.test.tsx`
   - `docs/GUIDED_OPERATOR_DEMO_SCENARIO.md`
   - `docs/FOREMAN_HANDOFF.md`
7. **Checks run:**
   - `npm test -- --run src/lib/__tests__/guided-operator-demo-scenario.test.ts src/components/__tests__/guided-operator-demo-scenario-panel.test.tsx src/components/__tests__/ops-lifecycle-records.test.tsx`
   - `npm test`
   - `npm run lint`
   - `npm run build`
   - `npm run verify`
   - `npm run verify:protocol`
   - `npm run safety:check`
   - `git diff --check`
8. **Passing checks:**
   - Focused guided scenario module/UI tests passed: 3 files, 9 tests.
   - Full test suite passed: 51 files, 278 tests.
   - Lint exited successfully.
   - Build passed.
   - Combined verify passed.
   - Protocol verify passed: 8 files, 61 tests.
   - Safety advisory check passed.
9. **Failing checks and exact errors, if any:**
   - No failing checks.
   - `npm run lint` still reports 13 pre-existing warnings in older files for unused imports/unused `_section`/`_patch` test parameters.
10. **Safety boundary:**
   - Guided scenario actions are fixture-only and review-only.
   - Lifecycle-affecting actions route through the existing lifecycle event API/integrity gate.
   - Oracle/liquidation-health uses the existing fixture helper.
   - Arbiter review uses the existing review-case path.
   - Simnet proof readiness uses the existing refresh helper.
   - No live Decred/BTC/EVM/oracle RPC, wallet integration, private keys, seed/mnemonic/passphrase handling, wallet unlock, app-side signing, broadcast, mainnet, real transactions, collateral release execution, liquidation execution, real fund movement, arbiter payout automation, new lifecycle system, new event system, or new review system was added.
11. **What is complete:**
   - Operators can inspect a guided scenario for a stored lifecycle record.
   - Operators can run one next safe fixture step or the full safe demo path.
   - The scenario emits/derives Decred collateral, platform-fee, borrow-asset disbursement, oracle health, evidence/timestamp, arbiter review, and simnet readiness state.
   - Duplicate runs stay idempotent under existing event/case gates in focused tests.
   - Borrower-safe scenario status remains simple.
12. **What remains:**
   - Monitor GitHub PR checks and address any CI-only failures.
   - Review whether the demo should include a repayment fixture in a future separate scenario, since this milestone follows the requested disbursement-to-proof-readiness path and keeps release proof readiness review-only/blocked where appropriate.
13. **Known risks/review points:**
   - The guided demo currently uses one deterministic happy/control-plane path, not multiple presets.
   - Simnet proof readiness may remain blocked if review/release preconditions are not satisfied, which is intentional for this review-only milestone.
   - The seeded record path is available through the API seam but the visible panel operates on already stored lifecycle records.
14. **Recommended next Foreman action:**
   - Review the PR for reuse of existing event/review/proof seams and confirm no parallel mutation path was introduced.
   - Verify the ops panel is clear enough for internal/community demos.
   - Decide whether a future branch should add a repayment-inclusive guided scenario preset.
15. **Recommended next developer prompt:**

```text
Review branch guided-operator-demo-scenario and PR "Add guided operator demo scenario".

Confirm the guided operator demo scenario runs only fixture/demo actions, routes lifecycle-affecting steps through submitHeadlessLifecycleEvent and the integrity gate, reuses existing oracle-health, arbiter-review, and simnet proof readiness helpers, and does not introduce signing, broadcast, mainnet, collateral release execution, liquidation execution, wallet/key handling, or real fund movement.

Run:
- npm run verify
- npm run verify:protocol
- npm run safety:check

Then inspect the ops lifecycle records page and verify the Guided demo scenario panel shows current phase, completed/blocked steps, next action, emitted event ids, arbiter case id, simnet proof session id, Broadcast blocked, and No signing/no real funds copy.
```

---

## Current Handoff: Simnet Proof Readiness

1. **Date:** 2026-07-07
2. **Branch:** `simnet-proof-readiness-scaffold`
3. **PR URL, if opened:** https://github.com/purpleLIQ/decred-capital-access-mvp/pull/99
4. **Latest commit SHA:** Implementation commit at PR creation: `374193144ddf4e84da098b3edd57be73c4cc1653`. The final pushed handoff-update commit SHA is listed in the final Codex output because a commit cannot contain its own hash without changing it.
5. **Summary:**
   - Added a review-only simnet proof readiness scaffold for stored headless lifecycle records.
   - Added pure readiness derivation from collateral, platform fee, evidence, arbiter/review, repayment/release, lifecycle event, and review-case state.
   - Added deterministic fixture proof session creation.
   - Added a small replaceable local proof-session store and API helper seam.
   - Added an ops API route to list/read and seed/refresh proof sessions from existing lifecycle records.
   - Added an ops-facing proof readiness panel to each lifecycle record card.
   - Added a practical simnet proof readiness doc.
6. **Files changed:**
   - `src/lib/simnet-proof-readiness.ts`
   - `src/lib/simnet-proof-readiness-store.ts`
   - `src/lib/simnet-proof-readiness-api.ts`
   - `src/app/api/simnet-proof-readiness/route.ts`
   - `src/components/simnet-proof-readiness-panel.tsx`
   - `src/components/ops-lifecycle-records.tsx`
   - `src/lib/__tests__/simnet-proof-readiness.test.ts`
   - `src/lib/__tests__/simnet-proof-readiness-api.test.ts`
   - `src/components/__tests__/simnet-proof-readiness-panel.test.tsx`
   - `src/components/__tests__/ops-lifecycle-records.test.tsx`
   - `docs/SIMNET_PROOF_READINESS.md`
   - `docs/FOREMAN_HANDOFF.md`
7. **Checks run:**
   - `npm test -- --run src/lib/__tests__/simnet-proof-readiness.test.ts src/lib/__tests__/simnet-proof-readiness-api.test.ts src/components/__tests__/simnet-proof-readiness-panel.test.tsx src/components/__tests__/ops-lifecycle-records.test.tsx`
   - `npm test`
   - `npm run lint`
   - `npm run build`
   - `npm run verify`
   - `npm run verify:protocol`
   - `npm run safety:check`
   - `git diff --check`
8. **Passing checks:**
   - Focused simnet proof readiness/API/UI tests passed: 4 files, 11 tests.
   - Full test suite passed: 49 files, 271 tests.
   - Lint exited successfully.
   - Build passed.
   - Combined verify passed.
   - Protocol verify passed: 8 files, 61 tests.
   - Safety advisory check passed.
   - Git whitespace check passed.
9. **Failing checks and exact errors, if any:**
   - No failing checks.
   - `npm run lint` still reports 13 pre-existing warnings in older files for unused imports/unused `_section`/`_patch` test parameters.
10. **Safety boundary:**
   - Every proof session remains review-only.
   - Broadcast is always blocked.
   - Signing session, signed-hex submission, and signature verification are placeholders and remain blocked.
   - No live Decred RPC, wallet integration, private keys, seed/mnemonic/passphrase handling, wallet unlock, app-side signing, broadcast, mainnet, real transactions, collateral release execution, liquidation execution, real fund movement, or arbiter payout automation was added.
11. **What is complete:**
   - Readiness model and deterministic session model exist.
   - Readiness is derived from the existing lifecycle/review/event surface without mutating lifecycle records.
   - Ops can seed/refresh a proof session from a stored lifecycle record.
   - Ops can see proof status, checklist items, blockers, next safe operator action, unsigned preview placeholder, signing placeholder, signed-hex placeholder, verification placeholder, and hard broadcast block.
12. **What remains:**
   - Monitor GitHub PR checks and address any CI-only failures.
   - Review whether release precondition should require full repayment/release readiness or allow other future proof types.
   - Future branch should define unsigned preview data structures and verification expectations without enabling execution.
13. **Recommended next Foreman action:**
   - Review the PR for safety boundaries first, then inspect whether the readiness gates match the intended future simnet proof flow.
   - Confirm the UI makes `Broadcast blocked` and `No signing, no broadcast, no real funds` obvious.
14. **Recommended next developer prompt:**

```text
Review branch simnet-proof-readiness-scaffold and PR "Add simnet proof readiness scaffold".

Confirm the simnet proof readiness scaffold is review-only, derives state from existing lifecycle/event/review records, never mutates lifecycle records from the pure helper, and keeps signing, signed-hex submission, signature verification, broadcast, mainnet, collateral release execution, liquidation execution, and real fund movement blocked.

Run:
- npm run verify
- npm run verify:protocol
- npm run safety:check

If checks pass, review mapping choices for collateral, platform fee, evidence, review, and release precondition gates. Do not add wallet/RPC/signing/broadcast/mainnet/liquidation/collateral release execution or real fund movement.
```

---

## Current Handoff: Integrity Review Routing

1. **Date:** 2026-07-07
2. **Branch name:** `integrity-review-routing`
3. **PR URL, if opened:** https://github.com/purpleLIQ/decred-capital-access-mvp/pull/98
4. **Latest commit SHA:** Implementation commit at PR creation: `968e6942fe31f8833b361294ddb082b95eae6758`. The final pushed handoff-update commit SHA is listed in the final Codex output because a commit cannot contain its own hash without changing it.
5. **Summary of completed work:**
   - Added deterministic integrity review-intent routing from the central lifecycle event submission path.
   - Kept integrity validation separate from arbiter/review case creation.
   - Reused the existing arbiter review case store and queue model.
   - Added duplicate-case prevention by linking repeated blocked integrity events to the existing open case for the same loan/case type.
   - Added compact `integrityReview` metadata to lifecycle event API results and stored event payloads.
   - Added ops event-history visibility for review recommendation, opened/linked status, case id, case type, borrower-safe summary, and operator summary.
   - Preserved borrower lookup safety by not exposing raw integrity labels in borrower-facing copy.
6. **Files changed:**
   - `src/lib/integrity-review-routing.ts`
   - `src/lib/headless-lifecycle-event-api.ts`
   - `src/lib/headless-lifecycle-events.ts`
   - `src/components/lifecycle-event-history.tsx`
   - `src/lib/__tests__/lifecycle-event-integrity.test.ts`
   - `docs/FOREMAN_HANDOFF.md`
7. **Files inspected but not changed:**
   - `src/lib/lifecycle-event-integrity.ts`
   - `src/lib/arbiter-review-cases.ts`
   - `src/lib/arbiter-case-api.ts`
   - `src/lib/arbiter-case-store.ts`
   - `src/lib/lifecycle-event-store.ts`
   - `src/components/headless-borrower-lifecycle.tsx`
   - `src/app/api/headless-loans/event-log/route.ts`
8. **Checks run:**
   - `npm test -- --run src/lib/__tests__/lifecycle-event-integrity.test.ts`
   - `npm test -- --run src/lib/__tests__/arbiter-review-cases.test.ts src/lib/__tests__/headless-lifecycle-events.test.ts src/lib/__tests__/oracle-liquidation-health-operator-api.test.ts`
   - `npm test`
   - `npm run build`
   - `npm run lint`
   - `npm run verify`
   - `npm run verify:protocol`
   - `npm run safety:check`
   - `git diff --check`
   - `git diff --cached --check`
9. **Passing checks:**
   - Targeted lifecycle integrity tests passed: 14 tests.
   - Targeted adjacent tests passed: 10 tests.
   - Full test suite passed: 46 files, 262 tests.
   - Build passed.
   - Lint exited successfully.
   - Combined verify passed.
   - Protocol verify passed: 8 files, 61 tests.
   - Safety advisory check passed.
   - Git whitespace checks passed.
10. **Failing checks and exact errors, if any:**
   - No failing checks at this point.
   - `npm run lint` still reports 13 pre-existing warnings in older files for unused imports/unused `_section`/`_patch` test parameters.
11. **Safety boundary confirmation:**
   - No live oracle providers were added.
   - No Decred/BTC/EVM RPC calls were added.
   - No wallet integration, seed/mnemonic/passphrase handling, wallet unlock, private-key handling, signing, broadcast, mainnet broadcast, liquidation execution, collateral release execution, real fund movement, or arbiter payout automation was added.
   - New review routing opens or links review scaffolding only.
12. **What is complete:**
   - Phase 1 integrity failure to review routing is implemented.
   - `unsafe_transition`, `contradictory`, `stale`, `out_of_order`, `missing_required_context`, and `needs_manual_review` can map to existing arbiter case types.
   - Harmless `duplicate` and `replayed` no-ops do not create review cases.
   - Repeated blocked integrity events for the same loan/category reuse the existing open case.
   - API responses include compact `integrityReview` metadata.
   - Ops history renders review metadata.
   - Borrower-facing copy remains simple and safe.
13. **What remains:**
   - Monitor GitHub PR checks and address any CI-only failures.
   - Merge after review if checks stay green and the mapping choices are accepted.
   - Phase 2 simnet proof readiness was not started in this branch.
14. **Known risks or review points:**
   - The central submit API now accepts an optional `arbiterStore`; existing callers can ignore it and production uses the default store.
   - New review cases are opened directly through the existing arbiter case store and a standard `arbiter_review_requested` event is recorded only when a new case is opened.
   - Reused/linked review cases update related lifecycle/watcher event ids, but no escalation/SLA/severity/assignment logic was added.
   - The latest commit SHA cannot be self-referential inside this committed handoff section; use the final Codex output and PR head SHA as source of truth.
15. **Recommended next Foreman action:**
   - Review PR checks and inspect that blocked integrity events open/link exactly one existing arbiter queue case per loan/case type.
   - Confirm no unsafe execution path was introduced.
   - If Phase 1 is accepted, consider a separate Phase 2 branch for simnet proof readiness scaffolding only.
16. **Recommended next developer prompt:**

```text
Review branch integrity-review-routing and PR "Route integrity failures to arbiter review".

Verify that integrity validation remains separate from review case creation, that derive/route integrity review intent reuses the existing arbiter case store, and that duplicate/replayed no-ops do not create cases. Confirm blocked stale/contradictory/out-of-order/unsafe events open or link one existing review case per loan/category, ops event history renders the linked case metadata, and borrower lookup does not expose raw integrity labels.

Run:
- npm run verify

Do not add wallet/RPC/signing/broadcast/mainnet/liquidation/collateral release execution or real fund movement.
```

---

## Current Handoff: Lifecycle Event Integrity Gate

Date: 2026-06-25
Branch: `lifecycle-event-integrity-v2`

This branch hardens the central lifecycle event path so duplicate, replayed, stale, out-of-order, contradictory, and unsafe lifecycle events do not corrupt headless loan records.

Completed in this pass:

- Added `src/lib/lifecycle-event-integrity.ts`.
- Extended `src/lib/lifecycle-event-store.ts` with lookup helpers for event id, external reference, watcher event id, health result id, and arbiter decision id.
- Wired `submitHeadlessLifecycleEvent(...)` so integrity validation runs before lifecycle mutation.
- Returned typed integrity metadata in the lifecycle event API result.
- Stored unique blocked/no-op events with integrity metadata for ops history.
- Avoided replacing original accepted events when the exact same event id is submitted again.
- Tagged arbiter decision lifecycle events with `arbiterDecisionId`.
- Added ops event-history visibility for integrity status, applied/no-op, reason, and audit note.
- Added focused tests in `src/lib/__tests__/lifecycle-event-integrity.test.ts`.
- Added `docs/LIFECYCLE_EVENT_INTEGRITY.md`.

Covered checks:

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

Safety boundary:

- no live oracle providers,
- no RPC calls,
- no wallet integration,
- no private-key handling,
- no signing,
- no broadcast,
- no mainnet path,
- no liquidation transaction creation,
- no liquidation execution,
- no funds movement.

Verification passed:

```bash
npm run verify
npm run verify:protocol
npm test
npm run lint
npm run build
npm run safety:check
```

Note: `npm run lint` exits successfully with 13 pre-existing warnings in older files.

Recommended next prompt:

```text
Review branch lifecycle-event-integrity-v2 for the central lifecycle event integrity gate.

Confirm the gate is wired only around submitHeadlessLifecycleEvent and does not create a parallel lifecycle system. Check that duplicate/replay/stale/unsafe events no-op before mutation, that ops event history shows integrity status, and that no wallet/signing/broadcast/mainnet/liquidation execution/funds movement was added.

If continuing development, add a narrow follow-up that records a formal manual-review case when integrity returns needs_manual_review or unsafe_transition, reusing the existing arbiter review queue. Do not create a new review system.

Run:
- npm run verify
```

---

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
