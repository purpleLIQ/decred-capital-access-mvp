# Roadmap Addendum: Borrow-Asset Watcher Scaffold

This addendum captures the BTC/EVM watcher direction for supplier disbursement and borrower repayment observation.

## Role

The borrow-asset watcher layer should eventually observe BTC, USDC, and USDT settlement events, compare them against expected lifecycle terms, and feed results into the stored headless lifecycle event path.

The current scaffold is fixture/manual only. It does not connect to live Bitcoin or EVM nodes, sign transactions, broadcast transactions, move funds, or prove real BTC/EVM settlement.

## Watcher-Shaped Events

The watcher model should support:

- supplier disbursement seen,
- supplier disbursement confirmed,
- supplier disbursement missing,
- supplier disbursement mismatch,
- repayment seen,
- repayment confirmed,
- repayment missing,
- repayment mismatch,
- watcher stale,
- watcher recovered,
- watcher reorged.

Events should preserve audit fields such as watcher event id, asset, rail/network, supplier position or fill id, txid/hash, output or log index, token contract, from/to address, observed amount, expected amount, confirmation/finality depth, block height/hash, stale/reorg/finality status, and audit note.

## Verification Direction

Pure verifier helpers should compare observed settlement events against expected supplier position, disbursement, or repayment terms.

Valid repayment observations must use the existing repayment allocation helper path so pro-rata repayment accounting remains centralized.

## Lifecycle Integration

Borrow-asset watcher results should map into existing lifecycle events rather than creating a parallel lifecycle system:

```text
borrow-asset watcher event
-> verifier result
-> lifecycle event adapter
-> stored lifecycle record update
-> repayment allocation refresh when relevant
-> ops event history
-> borrower-safe status
```

Future simnet, testnet, and mainnet integrations should replace fixture event sources behind the same typed boundary.
