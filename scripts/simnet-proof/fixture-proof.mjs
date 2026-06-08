#!/usr/bin/env node

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const artifactDir = "artifacts/simnet-fixture";

rmSync(artifactDir, { recursive: true, force: true });
mkdirSync(artifactDir, { recursive: true });

const artifacts = {
  "check-config.json": {
    ok: true,
    network: "simnet",
    readyForWalletRpcProbe: true,
    walletRoles: ["borrower", "lender", "arbiter"],
    blockers: [],
    safety: [
      "Fixture config only; no RPC calls are made.",
      "No wallet unlock, signing, broadcast, or private-key handling.",
    ],
  },
  "probe-rpc.json": {
    ok: true,
    network: "simnet",
    blockers: [],
    probes: [
      { role: "borrower", ok: true, network: "simnet", endpoint: "fixture-borrower-wallet" },
      { role: "lender", ok: true, network: "simnet", endpoint: "fixture-lender-wallet" },
      { role: "arbiter", ok: true, network: "simnet", endpoint: "fixture-arbiter-wallet" },
    ],
    safety: ["Fixture probe only; no RPC calls are made."],
  },
  "escrow-utxos.json": {
    ok: true,
    network: "simnet",
    blockers: [],
    escrowAddress: "SsFixtureEscrowAddressForCiOnly",
    selectedUtxoCount: 1,
    selectedDcr: 10,
    spendableAfterFeeDcr: 9.999,
    selectedUtxos: [
      {
        txid: "fixture000000000000000000000000000000000000000000000000000000000001",
        vout: 0,
        amountDcr: 10,
        confirmations: 12,
      },
    ],
    safety: ["Fixture UTXO only; no funds exist."],
  },
  "unsigned-release-preview.json": {
    ok: true,
    network: "simnet",
    blockers: [],
    unsignedTransaction: {
      id: "fixture_unsigned_release",
      network: "simnet",
      purpose: "collateral_release",
      loanId: "loan_fixture_ci",
      fromAddress: "SsFixtureEscrowAddressForCiOnly",
      toAddress: "SsFixtureBorrowerRefundForCiOnly",
      amountDcr: 9.999,
      estimatedFeeDcr: 0.001,
      requiredSignatures: 2,
      totalSigners: 3,
      rawTransactionHex: "01000000fixtureunsignedrelease",
      warnings: ["Fixture unsigned transaction. Do not broadcast."],
    },
    safety: [
      "Fixture unsigned transaction only.",
      "No signing, broadcast, wallet unlock, or private-key handling.",
    ],
  },
};

for (const [filename, content] of Object.entries(artifacts)) {
  writeFileSync(`${artifactDir}/${filename}`, JSON.stringify(content, null, 2));
}

const output = execFileSync(
  process.execPath,
  ["scripts/simnet-proof/validate-artifacts.mjs"],
  {
    encoding: "utf8",
    env: {
      ...process.env,
      SIMNET_CONFIG_ARTIFACT_PATH: `${artifactDir}/check-config.json`,
      SIMNET_PROBE_ARTIFACT_PATH: `${artifactDir}/probe-rpc.json`,
      SIMNET_UTXO_INSPECTOR_OUTPUT_PATH: `${artifactDir}/escrow-utxos.json`,
      SIMNET_PREVIEW_OUTPUT_PATH: `${artifactDir}/unsigned-release-preview.json`,
    },
  },
);

const report = JSON.parse(output);

const blockers = [];
if (report.ok !== true) blockers.push("Fixture artifact validation must pass.");
if (report.network !== "simnet") blockers.push("Fixture report must remain simnet-only.");
if (!report.results?.config?.present) blockers.push("Config fixture must be present.");
if (!report.results?.probe?.present) blockers.push("Probe fixture must be present.");
if (!report.results?.utxos?.present) blockers.push("UTXO fixture must be present.");
if (!report.results?.unsignedPreview?.present) blockers.push("Unsigned preview fixture must be present.");

const reportText = JSON.stringify({
  ok: blockers.length === 0,
  network: "simnet",
  artifactDir,
  validatorReport: report,
  blockers,
  safety: [
    "This fixture tester creates local JSON files only.",
    "It does not run dcrd or dcrwallet.",
    "It does not call RPC, sign, unlock wallets, broadcast, or execute liquidation.",
  ],
  createdAt: new Date().toISOString(),
}, null, 2);

writeFileSync(`${artifactDir}/fixture-proof-report.json`, reportText);
console.log(reportText);
process.exit(blockers.length === 0 ? 0 : 1);
