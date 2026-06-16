# Roadmap Addendum: Evidence Timestamping

This addendum captures the roadmap direction for Decred evidence timestamping.

## Role

Decred timestamping, likely through a future dcrtime or Timestamply-style adapter, may be used to anchor hashes or Merkle roots for evidence bundles.

Timestamp evidence, not decisions.

Timestamping supports auditability and transparency. It does not prove oracle data correctness, watcher validity, borrower default, policy correctness, or arbiter correctness.

## Data Boundary

Full evidence remains off-chain. Public or chain-visible metadata should stay compact:

- evidence hash,
- digest algorithm,
- provider,
- timestamp status,
- txid,
- Merkle root,
- Merkle path placeholder,
- chain timestamp,
- verification status,
- public summary id,
- audit-safe note.

Borrower contact, support notes, internal comments, and raw evidence bundles must not be included in public summaries or timestamp metadata.

## Integration Direction

Timestamping should be adapter-based and failure-tolerant. The app should be able to use manual fixture events now and later replace them with provider-backed events from dcrtime, Timestamply-style services, or Decred wallet timestamp tooling.

Timestamping must not be a hard blocker for normal borrower quote, lookup, contact, or repayment flow while the integration is still fixture-backed.

## Product Gate

Evidence timestamping is part of the auditability roadmap for arbiter review and future risk workflows. It is not a decision engine and must not be used by itself as a release, claim, or risk-resolution trigger.
