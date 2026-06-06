# Roadmap

## Phase 0: Research Validation

Objective: prove the core assumptions with local tools.

Deliverables:

- Documented dcrd/dcrwallet setup.
- Simnet scripts for three wallets.
- Verified 2-of-3 multisig create, fund, sign, release, and liquidation spend.

Success criteria:

- Two independent signers can move escrowed DCR.
- No single party can move collateral alone.

## Phase 1: Simnet Proof Of Concept

Objective: make the demo use real simnet DCR events.

Deliverables:

- Docker Compose for dcrd/dcrwallet.
- DecredAdapter simnet implementation.
- Confirmation watcher.

Success criteria:

- A local user can run one command and see real simnet deposits activate a loan.

## Phase 2: Web App MVP

Objective: make the product usable for demos.

Deliverables:

- Quote, loan, status, repayment, admin, market, and docs screens.
- Persistent local database.
- Seeded demo mode.

Success criteria:

- A non-coder can complete the full demo flow.

## Phase 3: Multisig Signing Flow

Objective: move from placeholder escrow to real signing.

Deliverables:

- Transaction preview.
- Signature collection.
- Signed-transaction validation.
- Release and liquidation transaction flows.

Success criteria:

- Borrower/lender/arbiter can complete happy-path and default-path signing in simnet.

## Phase 4: Price And Depth Integrations

Objective: make risk decisions use robust market data.

Deliverables:

- Kraken public market data.
- DCRDEX spots/order books.
- CoinGecko/CoinPaprika/CryptoCompare fallback.
- Stale/divergence checks.

Success criteria:

- App refuses risky state transitions when oracle health is poor.

## Phase 5: Liquidation Workflow

Objective: make default handling operator-safe.

Deliverables:

- Liquidation queue.
- Venue depth checks.
- Manual execution checklist.
- Audit trail.

Success criteria:

- Operator can see exactly why a liquidation is allowed or blocked.

## Phase 6: Limited Mainnet Alpha

Objective: run tiny capped real-money loans.

Deliverables:

- Separate production keys.
- Legal/compliance review.
- Monitoring.
- Emergency pause.

Success criteria:

- Small loans run safely with manual review.

## Phase 7: Production Hardening

Objective: turn alpha into a real lending product.

Deliverables:

- External security review.
- Stronger custody/key procedures.
- Better lender capital management.
- Partner wallet/exchange integrations.

Success criteria:

- The app can responsibly support larger loan sizes and external users.
