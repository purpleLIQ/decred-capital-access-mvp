# Evidence Commitments

This document defines privacy-first evidence and Decred commitment requirements.

## Direction

Liquidation, oracle, collateral, repayment, and arbiter decisions should be verifiable without publishing unnecessary borrower or supplier details.

Use:

```text
full evidence bundle off-chain
privacy-safe public summary
evidence hash committed or timestamped through Decred
```

Decred timestamping, including a future dcrtime or Timestamply-style adapter, is an evidence anchoring layer. It can prove that a compact evidence digest existed by a Decred timestamp. It does not prove the oracle data was correct, that a borrower defaulted, that a watcher event was valid, that policy was applied correctly, or that an arbiter made the right decision.

Timestamp evidence, not decisions.

## Evidence Bundle

A full evidence bundle may include:

- loan id,
- decision id,
- policy version,
- created timestamp,
- collateral amount,
- borrow asset,
- borrow amount,
- oracle sources,
- reference prices,
- LTV calculation,
- threshold values,
- grace window status,
- arbiter window status,
- watcher confirmations,
- transaction template identifiers,
- blockers,
- warnings,
- final recommended action.

## Privacy Rules

Public on-chain or timestamped metadata:

- evidence hash,
- digest algorithm,
- commitment or timestamp version,
- provider id such as `dcrtime`, `decred_wallet_timestamp`, or `manual`,
- optional compact protocol marker,
- txid / Merkle root / chain timestamp when available.

Public off-chain summary:

- decision status,
- timestamps,
- policy version,
- non-sensitive aggregate evidence,
- public summary id.

Participant-visible:

- full oracle evidence,
- loan terms,
- liquidation calculations,
- watcher confirmations,
- arbiter actions,
- transaction templates.

Never public:

- private contact info,
- support notes,
- unnecessary borrower metadata,
- unnecessary supplier metadata,
- internal operational comments,
- raw full evidence bundles.

## Commitment And Timestamp Flow

Recommended commitment flow:

```text
canonical evidence JSON
-> deterministic serialization
-> blake256 hash or Merkle root
-> Decred nulldata commitment
-> public proof that evidence has not changed
```

Recommended timestamp flow:

```text
canonical evidence JSON
-> deterministic serialization
-> sha256 placeholder / blake256 / Merkle root digest
-> dcrtime or Timestamply-style timestamp adapter
-> Decred-anchored timestamp proof
-> verification against the off-chain evidence bundle
```

The Decred chain should store only compact commitments or timestamp anchors, not full evidence JSON.

Timestamp integration should be adapter-based and failure-tolerant. A timestamp submission failure should create a retryable evidence status, not block normal borrower quote, lookup, or repayment flow.

## Verification Flow

A verifier should be able to:

1. Fetch or receive the evidence bundle.
2. Canonicalize the bundle.
3. Hash the canonical bundle.
4. Compare the hash to the Decred commitment or timestamp anchor.
5. Verify timestamp metadata such as provider, chain timestamp, txid, Merkle root, and Merkle path where available.
6. Confirm that the evidence matches the decision summary.

Timestamp verification proves existence of a digest at or before the timestamp. It does not validate the underlying claim. Oracle, watcher, arbiter, and policy verification remain separate requirements.

## Implementation Phases

Phase 1:

- evidence bundle type,
- privacy-safe public summary,
- deterministic hash function,
- tests for stable hashing.

Phase 2:

- Decred commitment transaction plan,
- simnet commitment artifact,
- lookup model,
- dcrtime / Timestamply-style timestamp provider interface,
- manual timestamp fixture events.

Phase 3:

- evidence browser for participants,
- public proof page,
- commitment verification helper,
- timestamp verification helper.

## Safety Rules

Do not store full evidence on-chain.

Do not publish private borrower or supplier details.

Do not treat a timestamp as a liquidation decision.

Do not treat a missing evidence commitment or timestamp as eligible for automatic liquidation.

Do not allow automatic fallback liquidation unless the evidence bundle, timestamp/commitment state, oracle state, watcher state, arbiter state, and policy state are complete.
