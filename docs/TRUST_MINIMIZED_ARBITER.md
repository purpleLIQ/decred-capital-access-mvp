# Trust-Minimized Arbiter Research

The MVP currently uses a 2-of-3 escrow model with borrower, lender, and arbiter roles. That is a practical starting point, but it leaves trust assumptions that users will ask about immediately.

This research track asks whether the arbiter role can be reduced with Decred-native script constraints or other Decred-native mechanisms.

## Goal

Minimize trust without pretending the product is trustless before it is proven.

The near-term product should explain the arbiter clearly. Future versions should investigate whether Decred script can enforce more of the escrow behavior directly.

## Questions To Answer

- Which arbiter duties are purely dispute resolution?
- Which arbiter duties are emergency recovery?
- Which arbiter duties are liquidation-related?
- Which of those can be replaced or limited with Decred script?
- Can timelocks give borrowers a recovery path if lender/arbiter do not cooperate after repayment?
- Can timelocks give lenders a recovery path after default without giving them unilateral control too early?
- Which conditions require off-chain price/oracle decisions and therefore cannot be fully enforced by Decred script alone?
- What user-facing trust claims are accurate?

## Candidate Designs

### 1. Plain 2-of-3 Escrow

Borrower, lender, and arbiter are all signers. Any two can move funds.

Pros:

- simple to explain,
- easiest to prove in simnet,
- works with current transaction-review and signing-collection model.

Cons:

- borrower must trust lender plus arbiter not to collude,
- lender must trust borrower plus arbiter not to collude,
- arbiter has meaningful power.

### 2. Script-Assisted 2-of-3 Escrow

Keep 2-of-3 signing, but add script paths that constrain recovery or timeout behavior.

Possible protections:

- borrower recovery path after repayment plus delay,
- lender recovery path after default plus delay,
- emergency path if one signer disappears.

Risks:

- script complexity,
- incorrect timeout assumptions,
- edge cases around partial repayment, liquidation state, and oracle disputes.

### 3. Timelock Recovery Path

A future design may allow collateral recovery after predefined time conditions if normal signing fails.

This could reduce arbiter trust but needs careful simnet modeling.

### 4. Oracle-Aware Arbiter Remains Off-Chain

Liquidation depends on price, liquidity, slippage, grace periods, and borrower notices. Those are hard to enforce purely on-chain. The app may still need an off-chain policy engine and signing/review process.

## Non-Goals For MVP

- Do not claim trustless lending.
- Do not remove the arbiter before simnet proves safer alternatives.
- Do not add mainnet script experiments.
- Do not let server automation sign or broadcast.

## Required Proof Before Adoption

Any script-assisted arbiter design needs:

- written threat model,
- exact script/spend path description,
- simnet proof transactions,
- failure case tests,
- external security review before mainnet use,
- user-facing disclosure of remaining trust assumptions.

## Current Recommendation

Continue the MVP with 2-of-3 escrow and external signing collection. In parallel, research Decred script-assisted escrow paths that reduce arbiter power in later versions.
