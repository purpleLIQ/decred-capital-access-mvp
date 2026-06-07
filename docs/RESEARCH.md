# Research Notes

These notes summarize the source-backed research used for the demo architecture.

## Decred Core

`dcrwallet` and `dcrctl` expose the primitives needed for a Decred multisig lending MVP:

- `createmultisig`
- `addmultisigaddress`
- `importscript`
- `listunspent`
- `createrawtransaction`
- `fundrawtransaction`
- `signrawtransaction`
- `sendrawtransaction`
- `getmultisigoutinfo`
- `redeemmultisigout`
- `redeemmultisigouts`

Sources:

- https://docs.decred.org/wallets/cli/dcrctl-rpc-commands/
- https://raw.githubusercontent.com/decred/dcrwallet/master/rpc/documentation/api.md
- https://github.com/decred/dcrwallet

## Testnet And Simnet

Decred testnet has no economic value and is suitable for testing before mainnet. Simnet is the recommended deterministic environment for proving escrow flows.

Sources:

- https://devdocs.decred.org/environments/testnet/
- https://dcrdata.decred.org/api/list

## DCRDEX

DCRDEX is a non-custodial atomic-swap DEX. It can provide price and depth context, but on-chain settlement is not instant and clients need to remain online during settlement. Live research found DCR/BTC depth, while DCR/stablecoin books were thin or empty at the time checked.

Sources:

- https://github.com/decred/dcrdex
- https://dex.decred.org/
- https://dex.decred.org/api/config
- https://dex.decred.org/api/spots
- https://dex.decred.org/api/orderbook/dcr/btc
- https://dex.decred.org/api/orderbook/dcr/usdc.polygon
- https://dex.decred.org/api/orderbook/dcr/usdt.polygon

## Kraken

Kraken public APIs verified DCR as enabled and DCRUSD as an online pair during research. Public endpoints are useful for oracle input. Trading, deposits, withdrawals, OTC, Prime, and Custody require accounts and authenticated API keys.

Sources:

- https://docs.kraken.com/api/docs/category/rest-api/market-data/
- https://api.kraken.com/0/public/Assets?asset=DCR
- https://api.kraken.com/0/public/AssetPairs?pair=DCRUSD
- https://api.kraken.com/0/public/Ticker?pair=DCRUSD
- https://api.kraken.com/0/public/Depth?pair=DCRUSD&count=10

## Cake Wallet

Cake Wallet has a `cw_decred` module that bridges Flutter to native `libdcrwallet` via FFI. It is useful as a mobile wallet integration reference but not a direct lending backend.

Source:

- https://github.com/cake-tech/cake_wallet/tree/dev/cw_decred

## Liquidium SDK

Liquidium does not provide DCR collateral support, but its SDK gives a strong model for the product shape: accountless instant loans, refs, transfer targets, LTV checks, loan restore, repayment quotes, and activity tracking.

Sources:

- https://liquidium.fi/docs
- https://liquidium-inc.github.io/liquidium-sdk/
- https://github.com/Liquidium-Inc/liquidium-sdk

## Ticket Collateral

Existing Decred ticket proofs can show that a borrower has locked stake and voting exposure, but they are not liquid collateral because the ticket cannot be canceled and proceeds only return after vote, miss, expiry, and maturity/revocation behavior. A new-ticket escrow design is possible research, not v1 functionality.

Sources:

- https://docs.decred.org/proof-of-stake/overview/
- https://docs.decred.org/faq/proof-of-stake/general/

## Payout Rail

Base Sepolia USDC is the easiest testnet-style payout rail. Native USDC on Base is a credible production direction because it is cheap, EVM-compatible, and supported by Circle.

Sources:

- https://developers.circle.com/stablecoins/usdc-contract-addresses
- https://docs.base.org/base-chain/network-information/network-faucets
- https://viem.sh/docs/actions/wallet/sendTransaction
- https://viem.sh/docs/contract/readContract
