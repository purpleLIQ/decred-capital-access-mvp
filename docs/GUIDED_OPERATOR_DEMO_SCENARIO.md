# Guided Operator Demo Scenario

This scenario gives operators deterministic demo paths across the current DCA control plane.

It is fixture-only and review-only. It does not call live Decred, Bitcoin, EVM, or oracle RPC. It does not use wallets, private keys, signing, broadcast, mainnet, collateral release execution, liquidation execution, or real funds.

## Presets

- `control_plane`: collateral, platform fee, supplier disbursement, health, evidence, arbiter visibility, and proof readiness refresh.
- `repayment_release_readiness`: collateral, platform fee, supplier disbursement, health, evidence, full repayment observation, collateral release readiness review, and proof readiness refresh.
- `partial_repayment_review`: collateral, platform fee, supplier disbursement, health, evidence, partial repayment observation, repayment review visibility, and blocked proof readiness refresh.
- `repayment_dispute_review`: collateral, platform fee, supplier disbursement, health, evidence, repayment mismatch observation, repayment dispute review visibility, and blocked proof readiness refresh.
- `top_up_review`: collateral, platform fee, supplier disbursement, health, evidence, top-up request warning, loan-health review visibility, and blocked proof readiness refresh.

## Repayment Flow

```text
stored lifecycle record
-> Decred collateral fixture
-> DCR platform-fee fixture
-> borrow-asset supplier disbursement fixture
-> oracle/liquidation-health fixture
-> evidence/timestamp placeholder
-> full repayment fixture
-> collateral release readiness review
-> simnet proof readiness refresh
-> broadcast remains blocked
```

## Exception Flows

```text
partial repayment preset
-> normal setup fixtures
-> partial repayment fixture
-> repayment review visibility
-> proof readiness remains blocked
```

```text
repayment dispute preset
-> normal setup fixtures
-> repayment mismatch fixture
-> repayment dispute review case
-> proof readiness remains blocked
```

```text
top-up review preset
-> normal setup fixtures
-> top-up request fixture
-> loan-health/top-up review visibility
-> proof readiness remains blocked
```

## Operator Surface

Open the ops lifecycle records page and use the `Guided demo scenario` panel on a lifecycle record.

The panel shows:

- current phase,
- selected preset,
- completed and blocked steps,
- next safe operator action,
- repayment status,
- release-readiness status,
- proof readiness status,
- emitted lifecycle event ids,
- linked arbiter case ids,
- simnet proof session id,
- hard broadcast block,
- no-signing/no-real-funds safety note.

The panel has fixture/demo actions only:

- `Refresh`
- `Run next`
- `Run selected preset`
- `Run repayment preset`

## Safety Rules

- All lifecycle-affecting steps submit through the existing lifecycle event API and integrity gate.
- Oracle/liquidation-health uses the existing fixture helper.
- Arbiter review uses the existing review-case path.
- Simnet proof readiness uses the existing refresh helper.
- Repayment observation uses the existing borrow-asset watcher fixture/lifecycle event path.
- Partial repayment and repayment dispute presets use the existing borrow-asset watcher fixture/lifecycle event path.
- Top-up review uses the existing oracle/liquidation-health fixture path with a deterministic guided-demo policy.
- Collateral release readiness is review-only. It is not release execution.
- Exception presets are review-only and intentionally leave collateral release and proof release preconditions blocked.
- Borrower-facing status stays simple, such as `Loan setup in progress`, `Funds sent review in progress`, `Repayment review in progress`, `Release review in progress`, `Proof readiness review in progress`, or `Loan completed, release review pending`.
- Broadcast stays blocked.

## Review Notes

This scenario is intended for internal/community demos and control-plane review. It is not a release flow. Future work should add richer scenario presets only after this single path is stable and reviewed.
