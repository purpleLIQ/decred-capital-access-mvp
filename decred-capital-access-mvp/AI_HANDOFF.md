# AI Handoff

You are continuing a Decred-native lending demo. The user is non-technical and wants a working, handoff-ready project that can eventually become a profit-generating Decred tool.

## Current State

- Next.js + TypeScript app.
- Demo-only local app with persistent SQLite via `sql.js`.
- No mainnet funds, no real keys, no real DCR signing.
- Live market data is best-effort and safely falls back to seeded demo values.
- Main UI is `src/components/demo-console.tsx`.
- Core behavior lives in:
  - `src/lib/loan-state-machine.ts`
  - `src/lib/risk.ts`
  - `src/lib/price-oracle.ts`
  - `src/lib/demo-db.ts`
  - `src/lib/adapters/*`

## Decisions Already Made

- Use 2-of-3 borrower/lender/arbiter Decred multisig as the intended custody model.
- Keep v1 liquidation manual.
- Use USDC as the recommended borrow rail.
- Treat DCR staking-ticket collateral as research-only until simnet proves controllable proceeds.
- Optimize for local demo and easy handoff before hosted mainnet ambition.

## Next Best Work

1. Add a real Decred simnet harness with `dcrd`, `dcrwallet`, and `dcrctl`.
2. Prove the full 2-of-3 escrow signing flow with three separate wallets.
3. Replace demo escrow strings with real `createmultisig` output.
4. Add a transaction review screen before any signature submission.
5. Add screenshots or a short demo GIF to the README.
6. Add a hosted demo path using Vercel or Cloudflare and Neon or D1.
7. Add GitHub Actions for tests/build.

## Guardrails

- Do not add mainnet signing until simnet validation is complete.
- Do not call the app fully trustless.
- Do not treat existing Decred tickets as liquid collateral.
- Do not store private keys in the database.
- Keep beginner docs current after every meaningful change.

## Suggested GitHub Repo

Name: `decred-capital-access-mvp`

Description: `Demo-mode DCR-backed lending app showing how Decred holders could borrow without selling.`
