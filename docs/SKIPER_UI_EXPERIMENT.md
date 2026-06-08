# Skiper UI Experiment

This branch is for a design-only trial of:

```bash
npx shadcn add @skiper-ui/skiper40
```

## Goal

Evaluate whether the component improves the visual design of the landing/borrower experience without adding risk to transaction review, signing, wallet, RPC, liquidation, or backend flows.

## Local Steps

Run from this branch:

```bash
git checkout experiment/skiper-ui
npx shadcn add @skiper-ui/skiper40
git diff
npm run verify
npm run demo
```

## Review Checklist

Before adopting anything from this experiment, inspect the diff for:

- new dependencies,
- large CSS/theme changes,
- external scripts or network calls,
- inaccessible interaction patterns,
- code that touches API routes,
- code that touches wallet/RPC/signing/broadcast/liquidation logic,
- unrelated formatting churn.

## Allowed Experiment Areas

Good candidates:

- landing page hero,
- borrower quote card styling,
- trust/safety explainer cards,
- empty states,
- non-critical marketing sections.

Avoid for now:

- transaction-review controls,
- signing-session controls,
- liquidation controls,
- wallet/RPC flows,
- anything that could confuse safety boundaries.

## Adoption Rule

If the component looks useful, keep only the minimum pieces needed for the app design. Do not blindly adopt a whole design system or unrelated generated files.

Any adoption PR should be design-only and should pass:

```bash
npm run verify
```
