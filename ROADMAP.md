# Roadmap

## Phase 1: Finish Testnet/Simnet Structure

Objective: prepare the app for real simnet proof without unsafe signing.

Deliverables:

- Transaction-review model.
- Simnet adapter.
- Wallet RPC config.
- Unsigned transaction builder.
- Review UI.
- Safety tests.

Success criteria:

- Demo and simnet stay blocked until unsigned transaction builders exist.
- No private keys are stored server-side.
- No transaction can move to signing without blockers cleared and approvals complete.

## Phase 2: Full Simnet Proof

Objective: prove the real Decred collateral lifecycle in an isolated environment.

Deliverables:

- Borrower, lender, and arbiter wallets.
- 2-of-3 escrow creation.
- Deposit/fund/repay/release flow.
- Liquidation path.
- Complete audit trail.

Success criteria:

- Two required signers can release collateral.
- No single party can move collateral alone.
- Release and liquidation paths produce auditable simnet transaction IDs.

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

## Phase 4: Production Backend

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

## Phase 5: Revenue And Accounting

Objective: make the product measurable as a business.

Deliverables:

- Origination fee collection.
- Platform treasury config.
- Fee ledger.
- Reconciliation.
- Revenue dashboard.

Success criteria:

- Every fee is traceable from quote to collection to accounting report.

## Phase 6: Legal And Security

Objective: reduce launch risk before real funds.

Deliverables:

- Legal/compliance review.
- Threat model.
- Key custody review.
- External code/security review.
- Operational runbooks.

Success criteria:

- The product has reviewed operating limits, key boundaries, incident processes, and user disclosures.

## Phase 7: Limited Launch

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
