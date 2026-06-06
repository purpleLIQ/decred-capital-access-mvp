# Production Readiness Plan

This app is still a demo-mode Decred lending MVP. Do not add mainnet signing or real user funds until simnet proves the 2-of-3 borrower, lender, and arbiter flow.

## Current safe baseline

- Next.js and TypeScript app.
- Local SQLite demo database.
- No private keys stored in the app or database.
- No mainnet funds touched.
- DCR price oracle blends Kraken, DIA, CoinGecko, and CoinPaprika where available, then safely falls back for demo mode.
- Platform fee is simulated and shown in quotes and loan records.

## Required gates before production

1. Prove 2-of-3 Decred multisig on simnet.
2. Add a transaction review screen before any signature request.
3. Replace demo escrow strings with real `createmultisig` output.
4. Add server-side persistence with migrations.
5. Add monitoring for oracle divergence, stale prices, and failed loan-state transitions.
6. Add legal review for lending, collateral handling, fee collection, restricted regions, and disclosures.
7. Run an outside security review before mainnet.

## Suggested production architecture

- Frontend: Vercel or Cloudflare Pages.
- Database: Neon, Supabase Postgres, or Cloudflare D1.
- Job runner: GitHub Actions or Cloudflare Workers Cron for price checks and loan reminders.
- Price feeds: DIA, Kraken, CoinGecko, CoinPaprika, and later a custom production oracle.
- Notifications: email first, then optional SMS/push.
- Signing: user-controlled Decred wallets only. Never store borrower, lender, or arbiter private keys.

## Revenue model

The app now models a 1% demo platform fee. Production should support a configurable fee schedule.

Recommended starting options:

- Origination fee: 0.5% to 1.0% of principal.
- Optional lender listing fee for preferred capital providers.
- Premium analytics/API access once loan volume exists.

Every fee must be shown before loan creation and again before repayment.
