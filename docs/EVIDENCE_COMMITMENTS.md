# Evidence Commitments

This document defines privacy-first evidence and Decred commitment requirements.

## Direction

Liquidation, oracle, collateral, repayment, and arbiter decisions should be verifiable without publishing unnecessary borrower or supplier details.

Use:

```text
full evidence bundle off-chain
privacy-safe public summary
evidence hash committed to Decred
```

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

Public on-chain:

- evidence hash,
- commitment version,
- optional compact protocol marker.

Public off-chain summary:

- decision status,
- timestamps,
- policy version,
- non-sensitive aggregate evidence.

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
- internal operational comments.

## Commitment Flow

Recommended flow:

```text
canonical evidence JSON
-> deterministic serialization
-> blake256 hash or Merkle root
-> Decred nulldata commitment
-> public proof that evidence has not changed
```

The Decred chain should store only compact commitments, not full evidence JSON.

## Verification Flow

A verifier should be able to:

1. Fetch or receive the evidence bundle.
2. Canonicalize the bundle.
3. Hash the canonical bundle.
4. Compare the hash to the Decred commitment.
5. Confirm that the evidence matches the decision summary.

## Implementation Phases

Phase 1:

- evidence bundle type,
- privacy-safe public summary,
- deterministic hash function,
- tests for stable hashing.

Phase 2:

- Decred commitment transaction plan,
- simnet commitment artifact,
- lookup model.

Phase 3:

- evidence browser for participants,
- public proof page,
- commitment verification helper.

## Safety Rules

Do not store full evidence on-chain.

Do not publish private borrower or supplier details.

Do not treat a missing evidence commitment as eligible for automatic liquidation.

Do not allow automatic fallback liquidation unless the evidence bundle and policy state are complete.
