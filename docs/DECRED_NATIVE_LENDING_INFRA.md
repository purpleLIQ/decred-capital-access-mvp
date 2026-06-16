# Decred-Native Lending Infrastructure

This document defines the target infrastructure for native DCR collateral lending.

## Goals

- Use native DCR as collateral.
- Avoid bridge custody.
- Avoid app custody.
- Avoid app-side private keys.
- Support BTC, USDC, and USDT borrowing through native-chain settlement verification.
- Keep current prototype safety boundaries until simnet and review gates pass.

## Current State

The current app can model transaction reviews, signing sessions, fixture signature verification, broadcast reviews, headless lifecycle records, lifecycle events, evidence timestamp anchors, and fixture/manual Decred watcher-shaped events. It does not prove real Decred signatures, real escrow spends, real liquidation execution, live watcher connectivity, or real broadcast paths.

## Required Infrastructure

### Decred Collateral Layer

The Decred collateral layer must eventually support:

- collateral funding transaction construction,
- DCR platform fee output verification,
- escrow UTXO tracking,
- release transaction templates,
- liquidation transaction templates,
- dispute/refund paths,
- evidence commitment transactions,
- simnet proofs before any real-funds path.

### Spend Path Research

Target spend paths:

```text
normal release:
  borrower + supplier/lender

borrower-protective dispute/refund:
  borrower + arbiter

liquidation/recovery:
  supplier/lender + arbiter

automatic fallback:
  unresolved until Decred script and simnet proof work identifies the safest constrained model
```

Open fallback designs:

- supplier + policy signer,
- supplier + arbiter set,
- threshold liquidator set,
- bonded liquidator set,
- delayed fallback script path.

No fallback model should be treated as accepted until simnet proof and security/protocol review.

## Platform Fee Output

The DCR collateral funding transaction should include:

```text
output 1: DCR collateral escrow
output 2: DCR platform fee address
output 3: borrower change, if any
```

Initial fee config:

```text
platformFeeBps = 100
platformShareBps = 7000
arbiterReserveShareBps = 3000
```

The fee is 1.00% of the DCR collateral amount and is split 70% platform / 30% arbiter reserve. All values must remain configurable.

Activation must be blocked if the fee output is missing, incorrect, or sent to the wrong address.

## Watcher Requirements

The Decred watcher must track:

- collateral output presence,
- platform fee output presence,
- confirmation depth,
- escrow UTXO state,
- release spends,
- liquidation spends,
- evidence commitment outputs,
- stale watcher state,
- reorg-sensitive events.

## Current Watcher Scaffold

The current watcher work is fixture/manual scaffolding only. It adds production-shaped event and verifier models for:

- collateral funding seen,
- collateral confirmed,
- collateral reorged,
- collateral spent,
- platform fee output seen,
- platform fee output confirmed,
- platform fee output missing,
- platform fee output mismatch,
- watcher stale,
- watcher recovered.

Pure helpers compare expected and observed DCR collateral or platform-fee outputs. Results are mapped into the headless lifecycle event path so stored lifecycle records can update collateral and fee-output sections.

This scaffold does not call a live Decred node. It does not sign, broadcast, move funds, or prove real on-chain collateral. Future simnet, testnet, and mainnet watchers should replace the fixture event source behind the same typed event and verifier boundary.

## Safety Rules

Do not add:

- app-side signing,
- wallet unlock,
- private-key handling,
- silent broadcast,
- mainnet broadcast,
- production liquidation execution.

Future automatic liquidation must remain blocked until oracle policy, arbiter windows, transaction templates, verifier checks, watcher state, evidence commitments, and simnet execution all pass.
