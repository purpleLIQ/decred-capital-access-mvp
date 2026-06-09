# Roadmap

This roadmap keeps the project moving toward a real Decred-backed lending product without crossing the current safety boundaries. The app is still a prototype: no real funds, no app-side signing, no app-side broadcasting, no mainnet support, and no production-readiness claim.

## Current Baseline

Implemented today:

- Demo borrower and operator flows.
- Transaction-review envelopes and readiness guards.
- Unsigned transaction preview groundwork.
- Simnet proof harness commands and fixture proof artifacts.
- Standalone signing-session UI at `/signing-sessions`.
- External signed-hex collection for required roles.
- Fixture signature verification for sample signed hex.
- Broadcast-review gate that returns `blocked` or `manual_review` and keeps `canBroadcast: false`.

Still not implemented:

- Real Decred signature verification.
- Real borrower wallet connection.
- Production broadcast adapter.
- Real liquidation execution.
- Mainnet support.
- Legal/compliance/custody operating process.

## Phase 1: Finish Review And Signing Structure

Objective: keep building the non-custodial transaction lifecycle without unsafe signing or broadcasting.

Delivered:

- Transaction-review model.
- Review UI.
- Approval and blocker model.
- `canMoveToSigning(review)` guard.
- Simnet adapter and wallet RPC config groundwork.
- Unsigned transaction builder seam.
- Signing-session state model and store.
- Signing-session API route wrappers.
- Signing-session UI.
- Fixture signature verification.
- Broadcast-review gate with broadcasting disabled.
- Safety tests.

Remaining:

- Expose the broadcast-review gate through a review-only API/helper.
- Add a UI action to create a broadcast review from a ready signing session.
- Display status, blockers, warnings, and fixture signature results.
- Keep `canBroadcast: false`.

Success criteria:

- Demo and simnet reviews stay blocked until readiness gates pass.
- No private keys are stored server-side.
- No transaction can move to signing without blockers cleared and approvals complete.
- No signed transaction can move past broadcast review without manual/operator review.
- No app-side broadcast path exists yet.

## Phase 2: Full Simnet Proof

Objective: prove the real Decred collateral lifecycle in an isolated environment.

Deliverables:

- Borrower, lender, and arbiter wallets.
- 2-of-3 escrow creation.
- Deposit/fund/repay/release flow.
- Liquidation path as transaction review, not app-side execution.
- Complete audit trail.
- Real unsigned transaction builders proven against running simnet wallets.
- Real signature verification for Decred transactions.

Success criteria:

- Two required signers can release collateral in simnet.
- No single party can move collateral alone.
- Release and liquidation paths produce auditable simnet transaction IDs.
- The app server still does not sign, unlock wallets, hold private keys, or silently broadcast.

## Phase 3: Autonomous Risk Engine

Objective: ensure production does not depend on manual liquidation memory.

Deliverables:

- Watcher job.
- Automated liquidation policy evaluation.
- Queueing transaction reviews.
- Notification system.
- Alerts.
- Retry and circuit breaker behavior.

Success criteria:

- Risky loans are detected automatically.
- Borrowers and operators are warned.
- Liquidation reviews are queued automatically when all gates pass.
- Signing and broadcast remain separate from the app server.
- Liquidation automation evaluates, queues, alerts, and circuit-breaks. It does not execute liquidation.

## Phase 4: Trust-Minimized Arbiter Research

Objective: reduce reliance on a trusted human/company arbiter by researching which escrow protections can move into Decred script or other Decred-native constraints.

This is a security track, not a blocker for the current MVP. The MVP may continue with 2-of-3 escrow while this track explores whether future versions can reduce arbiter trust.

Deliverables:

- Research note on Decred script capabilities and limits.
- Threat model for borrower/lender/arbiter collusion and non-cooperation.
- Script-assisted escrow design options.
- Timelock/recovery path options.
- Liquidation-limit analysis: what can be enforced on-chain versus what must remain off-chain.
- Simnet experiments for any proposed script-assisted spend paths.
- Clear decision record on whether to keep, reduce, or replace the arbiter role in later versions.

Success criteria:

- The roadmap can clearly explain why the MVP uses a 2-of-3 arbiter and what trust remains.
- At least one trust-reducing script-assisted design is evaluated in simnet or rejected with documented reasons.
- No production release claims “trustless” unless the claim is proven by script design, simnet/testnet evidence, and security review.
- User-facing docs can explain the arbiter risk honestly and show the plan to minimize it.

## Phase 5: Production Backend

Objective: replace demo storage and local assumptions.

Deliverables:

- Production database.
- Migrations.
- Secrets management.
- Background jobs.
- Logging.
- Monitoring.
- Rate limiting.
- Admin access controls.

Success criteria:

- Hosted alpha can run with reliable data, jobs, logs, and alerts.
- Production services still cannot access wallet secrets or sign transactions.

## Phase 6: Revenue And Accounting

Objective: make the product measurable as a business.

Deliverables:

- Origination fee collection design.
- Platform treasury config.
- Fee ledger.
- Reconciliation.
- Revenue dashboard.

Success criteria:

- Every fee is traceable from quote to collection to accounting report.
- Fee collection does not weaken custody, signing, or broadcast boundaries.

## Phase 7: Legal And Security

Objective: reduce launch risk before real funds.

Deliverables:

- Legal/compliance review.
- Threat model.
- Key custody review.
- External code/security review.
- Operational runbooks.
- Arbiter trust-minimization review.
- User disclosures for prototype, testnet, and production states.

Success criteria:

- The product has reviewed operating limits, key boundaries, incident processes, arbiter trust assumptions, and user disclosures.
- Claims about custody, escrow, liquidation, testnet readiness, or production readiness are backed by evidence.

## Phase 8: Limited Launch

Objective: run a capped beta only after simnet/testnet proof.

Deliverables:

- Testnet pilot.
- Capped production beta.
- Circuit breakers.
- Manual emergency stop.
- Monitoring and alerts.
- User docs.

Success criteria:

- Small, capped loans run with clear monitoring, emergency controls, and reviewed legal/security posture.
- Mainnet launch remains blocked until the signing, broadcast, liquidation, legal, and security gates are complete.
