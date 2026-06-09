# Roadmap

This roadmap aligns the project around the ideal Decred-native lending product while keeping dangerous capabilities behind explicit proof gates. The current app remains a prototype: no real funds, no app-side signing, no app-side broadcasting, no mainnet support, and no production-readiness claim.

## Product Direction

Build toward:

- native DCR collateral,
- native BTC, USDC, and USDT borrow assets,
- no bridges,
- no app custody,
- no app-side private keys,
- supplier offers and soft-pool UX before true pooled custody,
- partial loan fulfillment,
- supplier interest only on filled amounts,
- borrower-facing fast turnaround,
- transparent DCR platform fee,
- arbiter reserve funding,
- arbiter intervention before automatic fallback liquidation,
- privacy-first evidence commitments on Decred,
- optional future public/Treasury funding requests for large loans.

## Current Safety Boundary

Allowed now:

- demo-only UI,
- transaction review previews,
- unsigned transaction previews,
- external signed-hex collection,
- fixture signature verification,
- broadcast-review gate with `canBroadcast: false`,
- simnet artifact generation,
- docs and planning.

Not allowed now:

- real funds,
- mainnet paths,
- server-side signing,
- wallet unlock,
- private-key handling,
- automatic broadcast,
- production liquidation execution,
- bridge custody,
- true pooled custody,
- production-readiness claims.

Future automatic liquidation is a product requirement, but only after oracle, policy, arbiter, verifier, transaction-template, watcher, and simnet proof milestones are complete.

## Locked Product Decisions

- Collateral asset: DCR.
- Borrow assets: BTC, USDC, USDT.
- Liquidity model v0: supplier offers / soft-pool UX, not custody pools.
- Partial fulfillment: supported from the protocol model.
- Activation rule v0: 100% funding required unless borrower explicitly accepts partial funding later.
- Interest model v0: supplier quote APR plus configurable protocol, duration, and collateral-risk adjustments.
- No utilization-based rates in v0.
- Platform fee: 1% of DCR collateral amount.
- Fee collection: required output in the DCR collateral funding transaction.
- Initial fee split: 70% platform / 30% arbiter reserve, configurable.
- Evidence: full evidence off-chain, privacy-safe summaries, Decred on-chain hash commitments.
- Arbiter-agent Skill: later, after evidence schema, arbiter API, and arbiter state machine exist.
- Treasury/public funding request threshold: $10,000 equivalent, configurable, future research.
- Security and protocol review required before real funds.

## Target Loan Lifecycle

```text
borrower requests BTC / USDC / USDT
-> supplier offers partially fill the request
-> request reaches required funding threshold
-> borrower locks DCR collateral and pays platform fee
-> Decred watcher confirms collateral and fee outputs
-> suppliers disburse borrow asset
-> BTC/EVM watchers confirm disbursements
-> loan becomes active
-> borrower repays
-> repayments are allocated to supplier positions
-> oracle monitors loan health
-> warning/top-up window opens if needed
-> arbiter intervention window opens if needed
-> automatic fallback liquidation if needed
-> evidence hash is committed to Decred
```

## Phase 0: Docs And Scope Control

Objective: lock the ideal product architecture before additional implementation work.

Deliverables:

- `docs/DECRED_NATIVE_LENDING_INFRA.md`
- `docs/LIQUIDITY_SUPPLIERS.md`
- `docs/CROSS_CHAIN_BORROWING.md`
- `docs/LIQUIDATION_AND_ARBITERS.md`
- `docs/EVIDENCE_COMMITMENTS.md`
- refreshed `docs/AI_HANDOFF.md`
- refreshed `docs/OPERATIONS.md`

Success criteria:

- Docs distinguish current prototype behavior from future target behavior.
- Docs remove stale assumptions about broadcast review not being exposed.
- Docs make supplier liquidity, partial fills, fee config, evidence commitments, arbiter windows, and automatic fallback liquidation explicit.
- Docs avoid legal-positioning claims and keep security/protocol review as the real-funds gate.

## Phase 1: Protocol Domain Foundation

Objective: define the ideal protocol model without live chain calls.

Deliverables:

- `BorrowAsset`: BTC, USDC, USDT.
- `CollateralAsset`: DCR.
- `LoanRequest`.
- `SupplierOffer`.
- `SupplierFill`.
- `SupplierPosition`.
- `LoanFundingState`.
- `InterestRateConfig`.
- `PlatformFeeConfig`.
- `OracleSnapshot`.
- `LiquidationPolicy`.
- `EvidenceBundle`.

Tests:

- partial fills,
- 100% funding threshold,
- supplier position accounting,
- supplier earns only on filled amount,
- blended APR calculation,
- platform fee calculation,
- 70/30 fee split,
- privacy-safe evidence summary.

## Phase 2: Supplier Offer Book And Partial Fills

Objective: support supplier offers and borrower requests with fast-feeling partial fulfillment.

Deliverables:

- supplier offer creation,
- offer edit/pause/cancel,
- borrower loan request creation,
- partial fill reservations,
- funding window,
- funding expiration,
- funding progress state,
- supplier position creation after activation.

Success criteria:

- A borrower request can be filled by multiple suppliers.
- Supplier interest accrues only on filled positions.
- Unfunded or expired requests do not require collateral lock or fee payment.
- Borrower UI can show percent funded, estimated APR, and next action.

## Phase 3: Interest Quotes And Platform Fee

Objective: make quote economics transparent and configurable.

Deliverables:

- supplier quote APR,
- protocol spread,
- duration premium,
- collateral-risk premium,
- weighted/blended borrower APR,
- 1% DCR platform fee,
- editable fee bps,
- configurable platform/arbiter reserve split,
- required DCR fee output verifier scaffold.

Success criteria:

- Borrower can see rate components and DCR platform fee before collateral lock.
- Loan activation is blocked if expected fee output is absent or wrong.
- Fee config can be edited without code rewrites.

## Phase 4: Cross-Chain Watcher Interfaces

Objective: define native-chain settlement verification boundaries.

Deliverables:

- Decred watcher interface,
- Bitcoin watcher interface,
- EVM token watcher interface,
- fixture-backed watcher adapters,
- confirmation/finality rules,
- stale watcher detection,
- idempotent event processing.

Success criteria:

- The app can model DCR collateral, BTC disbursement/repayment, and USDC/USDT disbursement/repayment without bridges.
- Fixture events prove state transitions without live funds.

## Phase 5: Oracle And Liquidation Policy Scaffolding

Objective: implement deterministic risk and liquidation eligibility logic.

Deliverables:

- multi-source oracle snapshot model,
- price freshness checks,
- source deviation checks,
- conservative reference price,
- LTV calculation,
- warning threshold,
- liquidation threshold,
- borrower grace/top-up window,
- arbiter intervention window,
- automatic fallback eligibility state,
- circuit breakers.

Success criteria:

- Bad/stale/disagreeing oracle data blocks liquidation.
- Liquidation eligibility can be explained from evidence.
- Automatic fallback can become eligible only after policy gates pass.

## Phase 6: Evidence Bundle And Decred Commitment Model

Objective: make decisions verifiable while preserving privacy.

Deliverables:

- canonical evidence bundle model,
- participant-visible evidence bundle,
- privacy-safe public summary,
- evidence hash,
- Decred nulldata commitment plan,
- evidence lookup model.

Success criteria:

- Full evidence is not stored on-chain.
- On-chain commitment proves evidence integrity.
- Public metadata avoids unnecessary borrower/supplier details.

## Phase 7: Decred Collateral Contract Templates

Objective: define DCR collateral spend paths and prove them in simnet.

Deliverables:

- normal release path,
- borrower refund path,
- supplier/arbiter liquidation path,
- borrower/arbiter dispute path,
- automatic fallback path candidates,
- timelock requirements,
- signature role requirements,
- simnet proof checklist.

Success criteria:

- No single party can move collateral alone in the intended escrow path.
- Spend paths are documented before code claims trust minimization.
- Automatic fallback design remains blocked until simnet proof.

## Phase 8: Arbiter System

Objective: add arbiter intervention before automatic fallback liquidation.

Deliverables:

- arbiter case queue,
- arbiter eligibility model,
- arbiter actions,
- pause/confirm/resolve behavior,
- arbiter window expiry,
- arbiter score v0,
- arbiter reserve payout model.

Success criteria:

- Founder/operator manual liquidation review is not part of the target path.
- Arbiters can handle edge cases before fallback liquidation.
- Objective scoring matters more than subjective ratings.

## Phase 9: Simnet Automatic Fallback Liquidation

Objective: prove automatic fallback liquidation only in a safe isolated environment.

Deliverables:

- liquidation transaction template generation,
- transaction verifier,
- evidence bundle creation,
- simnet-only broadcast adapter,
- post-liquidation accounting,
- Decred evidence commitment in simnet.

Success criteria:

- Automatic fallback works only after policy/verifier/evidence gates pass.
- No mainnet path exists.
- No app-side private keys or wallet unlock calls are introduced.

## Phase 10: Supplier Soft-Pool UX

Objective: make supplier offers feel like pooled liquidity without pooled custody.

Deliverables:

- aggregated liquidity display,
- borrower fast-match UX,
- supplier dashboard,
- supplier auto-quoting hooks,
- liquidity availability estimates.

Success criteria:

- Borrowers see fast, pool-like liquidity.
- Suppliers keep custody until matched/disbursed.
- True pooled custody remains out of scope until separately designed and reviewed.

## Phase 11: Arbiter-Agent Skill

Objective: package arbiter evidence review workflow for AI agents after the real evidence and arbiter APIs exist.

Prerequisites:

- stable evidence schema,
- stable arbiter action model,
- arbiter API,
- arbiter UI,
- tested policy state machine.

The Skill should help arbiters summarize evidence, identify blockers, and recommend allowed actions. It must not bypass protocol rules or blindly decide liquidations.

## Phase 12: Politeia / Treasury Special Requests

Objective: research optional public funding requests for larger loans.

Future concept:

```text
borrower requests loan above treasuryRequestThresholdUsd
-> borrower opts into public request path
-> system prepares public/Treasury funding request
-> Treasury funds the loan if approved
-> Treasury earns all interest
-> if borrower defaults, collateral is sent to Treasury path
```

Initial threshold:

```text
treasuryRequestThresholdUsd = 10000
```

This is future research. It should not be used for private borrower data, real-time matching, liquidation execution, or v0 loan fulfillment.

## Phase 13: Security And Protocol Review

Objective: review the protocol before real funds.

Review areas:

- Decred script templates,
- transaction construction,
- signature verification,
- watcher correctness,
- oracle policy,
- liquidation policy,
- arbiter state machine,
- automatic fallback liquidator,
- platform fee verifier,
- evidence commitment format,
- cross-chain watcher logic,
- supplier repayment allocation.

Success criteria:

- Claims about custody, escrow, liquidation, testnet readiness, or production readiness are backed by evidence.
- Real funds remain blocked until security and protocol review is complete.

## Scope-Control Rules

Do not build until explicitly scheduled:

- real funds,
- mainnet paths,
- automatic production broadcast,
- app-side signing,
- wallet unlock,
- private-key handling,
- true custody pools,
- Treasury request integration,
- arbiter-agent Skill,
- production liquidation execution.

Build toward now:

- ideal protocol docs,
- domain models,
- supplier offers,
- partial fills,
- fee config,
- blended APR,
- evidence schema,
- oracle/liquidation policy scaffolding,
- arbiter state machine scaffolding,
- watcher interfaces.
