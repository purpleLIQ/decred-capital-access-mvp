# Risk Model

## Main Risks

- Oracle manipulation or stale pricing.
- Thin DCR liquidity.
- DCRDEX stablecoin order books being empty.
- Kraken/CEX dependency for fallback liquidation.
- Borrower abandonment.
- Lender or arbiter griefing.
- Hot-wallet risk for borrow assets.
- Private key leakage.
- Database tampering.
- Misleading trustless claims.

## Guardrails

- Target initial LTV: 25% to 35%.
- Liquidation review threshold: around 70% LTV.
- Manual approval for v1.
- Small loan caps.
- Blended oracle.
- Stale and divergent price rejection.
- Circuit breaker for thin market depth.
- No mainnet automation until simnet tests pass.

## What Multisig Protects

- Borrower cannot unilaterally withdraw collateral after funding.
- Lender cannot unilaterally seize collateral.
- Arbiter cannot move funds alone.

## What Multisig Does Not Protect

- Market price collapse.
- Bad oracle data.
- Bad liquidation execution.
- Stablecoin issuer risk.
- Legal/compliance risk.
