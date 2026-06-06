# Demo Mode

Demo mode is designed for a non-technical walkthrough.

## No Real Funds

The app does not use:

- mainnet DCR,
- real private keys,
- real USDC,
- real Decred transaction broadcasting.

## Persistent Local Data

The app creates `data/demo.sqlite` on first run. Delete that file to reset seeded demo loans.

## Live Market Data

The app tries to read public market data. If a source is unavailable, it falls back safely to seeded demo values and shows a warning.
