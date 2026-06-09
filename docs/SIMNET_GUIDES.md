# Simnet Guides

Use these docs for the current simnet proof stage:

- `docs/SIMNET_PROOF_PLAN.md` — overall proof path, current fixture/demo boundary, and pass/fail rules.
- `docs/SIMNET_RUNBOOK.md` — general simnet harness commands.
- `docs/SIMNET_COLLATERAL_RELEASE_PROOF.md` — collateral release proof milestone.
- `docs/SIMNET_COLLATERAL_RELEASE_PROOF_RUNBOOK.md` — PowerShell-friendly collateral release proof steps.
- `docs/WINDOWS_SIMNET_SETUP.md` — Windows and PowerShell setup flow.

Use this template for local PowerShell sessions:

- `scripts/simnet-proof/env-template.ps1`

Current harness commands:

```bash
npm run simnet:check-config
npm run simnet:probe-rpc
npm run simnet:inspect-escrow-utxos
npm run simnet:build-unsigned-preview
npm run simnet:validate-artifacts
npm run simnet:fixture-proof
```

`npm run simnet:fixture-proof` creates local JSON artifacts only. It does not prove real simnet escrow, real Decred signatures, production readiness, or mainnet readiness.

Do not commit populated environment files, RPC passwords, wallet secrets, private keys, wallet files, passphrases, seeds, mnemonics, xprvs, or generated artifacts that include sensitive local details.
