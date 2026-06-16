# Roadmap Addendum: Decred Watcher Scaffold

This addendum captures the Decred watcher direction for collateral lock and DCR platform fee-output verification.

## Role

The Decred watcher layer should eventually observe DCR collateral and platform-fee outputs, compare them against expected loan terms, and feed the result into the stored headless lifecycle event path.

The current scaffold is fixture/manual only. It does not connect to a live Decred node, sign transactions, broadcast transactions, move funds, or prove real on-chain collateral.

## Watcher-Shaped Events

The watcher model should support:

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

Each event should preserve audit fields such as watcher event id, network, txid, output index, amount, expected amount, expected destination, observed destination, confirmations, block height/hash, stale/reorg status, and audit note.

## Verification Direction

Pure verifier helpers should compare observed DCR outputs against expected terms and return typed results. Platform fee verification must preserve the future production rule that a loan cannot proceed if the required fee output is missing, wrong amount, or sent to the wrong destination.

The current PR creates the typed result path only. It does not activate loans.

## Lifecycle Integration

Watcher results should map into existing lifecycle events rather than creating a parallel lifecycle system:

```text
Decred watcher event
-> verifier result
-> lifecycle event adapter
-> stored lifecycle record update
-> ops event history
-> borrower-safe status
```

Future simnet, testnet, and mainnet integrations should replace fixture event sources behind the same typed boundary.
