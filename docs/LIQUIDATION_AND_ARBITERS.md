# Liquidation And Arbiters

This document defines the target liquidation and arbiter model.

## Direction

The founder/operator should not be responsible for reviewing liquidations.

Target responsibility model:

```text
oracle and policy engine detect risk
-> borrower warning/top-up window
-> arbiter intervention window
-> automatic fallback liquidation if unresolved
```

Current implementation still does not execute liquidation.

## Evidence Timestamping Role

Decred timestamping, through a future dcrtime or Timestamply-style adapter, is useful for anchoring evidence bundle hashes during arbiter review. It is an auditability and transparency tool.

Timestamp evidence, not decisions.

A timestamp can show that a specific digest existed by a Decred chain timestamp. It does not prove oracle correctness, watcher correctness, borrower default, policy correctness, or arbiter correctness. Arbiters must still review the underlying evidence, policy state, watcher confirmations, and borrower/supplier context.

Only compact timestamp metadata should be public: evidence hash, digest algorithm, provider, txid, Merkle root, chain timestamp, verification status, and public summary id. Full evidence, borrower contact, support notes, and internal comments must stay off-chain and private.

## Oracle Policy

Oracle inputs should include:

- source,
- asset pair,
- price,
- timestamp,
- latency,
- confidence,
- failure reason.

Policy should track:

- minimum source count,
- maximum source age,
- maximum price deviation,
- median price,
- conservative reference price,
- source disagreement,
- circuit breaker state.

Default safety rule:

```text
bad oracle data blocks liquidation
```

## Loan Health States

Target states:

```text
healthy
warning
margin_call
liquidation_eligible
arbiter_window_open
auto_liquidation_pending
resolved
blocked
```

## Borrower Protection Window

Before liquidation, borrowers should have a warning/top-up window when policy allows.

Allowed borrower actions:

- repay,
- top up collateral,
- request arbiter review,
- do nothing.

## Arbiter Window

Arbiters provide faster/fairer intervention before automatic fallback.

Allowed arbiter actions:

- confirm liquidation,
- pause liquidation,
- request more evidence,
- recognize repayment,
- recognize top-up,
- mark dispute,
- resolve case.

## Arbiter Rollout

Recommended phases:

```text
Phase A: internal/test arbiters
Phase B: allowlisted arbiters
Phase C: bonded arbiters
Phase D: reputation-gated arbiters
Phase E: open arbiter market
```

Open arbiters should wait until anti-gaming controls exist.

Anti-gaming controls:

- wallet-tied history,
- DCR bond or stake requirement,
- minimum completed case count,
- objective score weighting,
- missed-deadline penalties,
- false-intervention penalties,
- case reversal tracking,
- borrower/supplier feedback with lower weighting.

## Arbiter Scoring

Objective signals should matter more than subjective ratings.

Score inputs:

- response time,
- completion rate,
- policy consistency,
- missed deadlines,
- false interventions,
- case reversals,
- evidence quality,
- bond/stake age,
- borrower feedback,
- supplier feedback.

## Arbiter Compensation

Initial funding source:

```text
arbiter reserve funded from DCR platform fee
```

Initial fee split:

```text
70% platform
30% arbiter reserve
```

Future funding sources may include:

- liquidation penalty share,
- case-specific arbitration fees,
- reputation-tiered arbiter payouts.

## Automatic Fallback Liquidation

Automatic liquidation is a target capability, not current behavior.

Automatic fallback can be considered only after:

- fresh oracle data,
- source quorum,
- deviation checks,
- loan state consistency,
- watcher freshness,
- borrower grace/top-up window,
- arbiter window completion or valid bypass condition,
- verified transaction template,
- evidence bundle,
- evidence commitment or timestamp anchor,
- simnet proof.

Block automatic liquidation when:

- oracle data is stale,
- sources disagree too much,
- watcher state is stale,
- loan state is inconsistent,
- repayment is pending,
- top-up is pending,
- transaction template does not match policy,
- evidence hash is missing,
- required signer path is not proven.

A timestamp alone must never satisfy the evidence or policy gate. It only anchors an evidence digest.

## Future Automatic Authority Model

Open design options:

- supplier + arbiter,
- supplier + policy signer,
- threshold liquidator set,
- bonded liquidator set,
- delayed fallback script path.

Do not select a final model until Decred script feasibility and simnet proofs are complete.

## Arbiter-Agent Skill

The arbiter-agent Skill belongs later.

Prerequisites:

- stable evidence bundle schema,
- stable arbiter actions,
- arbiter API,
- arbiter UI,
- tested policy state machine.

The Skill should help summarize evidence, identify blockers, and recommend allowed actions. It must not bypass protocol rules or blindly decide liquidations.
