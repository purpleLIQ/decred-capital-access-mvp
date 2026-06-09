# Liquidity Suppliers

This document defines the target supplier/liquidity model.

## Direction

Use supplier offers and soft-pool UX before true pooled custody.

The borrower should experience fast liquidity, but supplier funds should remain controlled by suppliers until matched and disbursed.

## Borrow Assets

Supported target borrow assets:

- BTC,
- USDC,
- USDT.

## Supplier Offers

A supplier offer should describe:

- asset,
- available amount,
- minimum fill amount,
- minimum APR,
- maximum duration,
- minimum collateral ratio,
- repayment address,
- risk preferences,
- arbiter preferences,
- auto-fill preference.

## Partial Fills

Borrower requests may be filled by multiple suppliers.

Example:

```text
borrower requests 1 BTC
supplier A fills 0.25 BTC
supplier B fills 0.40 BTC
supplier C fills 0.35 BTC
loan reaches 100% funding
borrower receives 1 BTC
```

Each supplier earns interest only on the amount actually filled.

## Supplier Positions

A supplier position should track:

- supplier wallet,
- borrow asset,
- filled amount,
- APR,
- start time,
- repayment address,
- principal due,
- interest due,
- status.

## Funding Window

A borrower request should have a funding deadline.

If the request does not reach the required threshold before expiry:

- supplier reservations expire,
- loan does not activate,
- borrower does not lock collateral,
- platform fee is not charged.

V0 activation rule:

```text
100% funding required before collateral lock
```

Future optional rule:

```text
borrower may explicitly accept partial funding
```

## Activation Sequence

Preferred v0 sequence:

```text
borrower creates request
-> suppliers reserve/fill request
-> request reaches required funding threshold
-> borrower locks DCR collateral and pays platform fee
-> Decred watcher confirms collateral and fee outputs
-> suppliers disburse borrow asset
-> BTC/EVM watchers confirm disbursements
-> loan becomes active
```

This avoids asking the borrower to lock DCR before liquidity is ready.

## Repayment Allocation

Recommended v0 repayment allocation:

```text
pro rata across supplier positions
```

Example:

```text
supplier A funded 25%
supplier B funded 75%

each repayment is allocated:
25% to A
75% to B
```

Alternative allocation models such as FIFO, waterfall, or independent supplier repayment can be considered later.

## Interest Model

V0 interest should not use pool utilization.

Use:

```text
supplier quote APR
+ protocol spread
+ duration premium
+ collateral-risk premium
```

For multiple fills, calculate a weighted supplier APR and then add protocol adjustments.

Example:

```text
supplier A fills 0.25 BTC at 8% APR
supplier B fills 0.75 BTC at 10% APR

weighted supplier APR = 9.5%
borrower APR = weighted supplier APR + protocol adjustments
```

Config should support:

- base APR by asset,
- minimum APR by asset,
- maximum APR by asset,
- protocol spread bps,
- duration premium bps,
- collateral-risk premium bps.

## Soft-Pool UX

Soft-pool UX should aggregate supplier offers without custody pooling.

Borrowers may see:

- available BTC liquidity,
- available USDC liquidity,
- available USDT liquidity,
- estimated APR range,
- funding progress,
- likely fill speed.

Under the hood, these are supplier offers and partial fills.

## Future True Pools

True pooled custody is out of scope until separately designed and reviewed.

Do not add true custody pools until:

- supplier offers are proven,
- watcher infrastructure is proven,
- repayment allocation is proven,
- security/protocol review is complete,
- custody and withdrawal assumptions are explicitly documented.
