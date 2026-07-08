# Guided Operator Demo Scenario

This scenario gives operators one deterministic demo path across the current DCA control plane.

It is fixture-only and review-only. It does not call live Decred, Bitcoin, EVM, or oracle RPC. It does not use wallets, private keys, signing, broadcast, mainnet, collateral release execution, liquidation execution, or real funds.

## Flow

```text
stored lifecycle record
-> Decred collateral fixture
-> DCR platform-fee fixture
-> borrow-asset supplier disbursement fixture
-> oracle/liquidation-health fixture
-> evidence/timestamp placeholder
-> arbiter review visibility
-> simnet proof readiness refresh
-> broadcast remains blocked
```

## Operator Surface

Open the ops lifecycle records page and use the `Guided demo scenario` panel on a lifecycle record.

The panel shows:

- current phase,
- completed and blocked steps,
- next safe operator action,
- emitted lifecycle event ids,
- linked arbiter case ids,
- simnet proof session id,
- hard broadcast block,
- no-signing/no-real-funds safety note.

The panel has fixture/demo actions only:

- `Refresh`
- `Run next`
- `Run safe demo`

## Safety Rules

- All lifecycle-affecting steps submit through the existing lifecycle event API and integrity gate.
- Oracle/liquidation-health uses the existing fixture helper.
- Arbiter review uses the existing review-case path.
- Simnet proof readiness uses the existing refresh helper.
- Borrower-facing status stays simple, such as `Loan setup in progress`, `Collateral review in progress`, `Loan health review in progress`, or `Proof readiness review in progress`.
- Broadcast stays blocked.

## Review Notes

This scenario is intended for internal/community demos and control-plane review. It is not a release flow. Future work should add richer scenario presets only after this single path is stable and reviewed.
