# Cross-Chain Borrowing

This document defines the target cross-chain borrowing model.

## Direction

Borrowers lock native DCR collateral and borrow native BTC, USDC, or USDT.

The protocol should avoid bridges and avoid app custody.

## Target Assets

Collateral:

- DCR

Borrow assets:

- BTC
- USDC
- USDT

## Settlement Model

The protocol verifies native-chain events rather than wrapping assets.

```text
DCR collateral: Decred
BTC disbursement/repayment: Bitcoin
USDC disbursement/repayment: supported EVM networks
USDT disbursement/repayment: supported EVM networks
```

## Watchers

Required watchers:

- Decred watcher,
- Bitcoin watcher,
- EVM token watcher.

### Decred Watcher

Tracks:

- collateral funding,
- platform fee output,
- confirmation depth,
- escrow UTXO state,
- release spends,
- liquidation spends,
- evidence commitment outputs.

### Bitcoin Watcher

Tracks:

- BTC supplier disbursements,
- BTC borrower repayments,
- confirmation depth,
- reorg-sensitive events,
- stale watcher state.

### EVM Token Watcher

Tracks:

- USDC disbursements,
- USDC repayments,
- USDT disbursements,
- USDT repayments,
- token contract identity,
- chain/finality rules,
- stale watcher state.

## Loan Activation

Preferred v0 activation sequence:

```text
borrower request reaches required funding threshold
-> borrower locks DCR collateral and pays platform fee
-> Decred watcher confirms DCR collateral and fee outputs
-> suppliers disburse BTC/USDC/USDT
-> BTC/EVM watchers confirm disbursements
-> loan becomes active
```

The app must not mark a loan active until the required native-chain events are detected and confirmed.

## Repayment

Repayment is native-chain repayment in the borrow asset.

The watcher confirms repayment and the protocol allocates repayment pro rata across supplier positions unless a later roadmap explicitly changes this rule.

## Treasury/Public Request Research

Future research may support public/Treasury funding requests for large loans.

Initial threshold:

```text
treasuryRequestThresholdUsd = 10000
```

Potential future flow:

```text
borrower request exceeds threshold
-> borrower opts into public request path
-> public/Treasury funding request is prepared
-> Treasury funds if approved
-> Treasury earns all interest
-> default sends collateral to Treasury-controlled path
```

This is not v0 and must not be used for real-time matching, private borrower data, or liquidation execution.

## Safety Boundaries

Do not add:

- bridges,
- app custody,
- server-side signing,
- app-owned private keys,
- mainnet broadcast,
- production liquidation execution.
