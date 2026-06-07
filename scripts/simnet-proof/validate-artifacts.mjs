#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";

const defaultPaths = {
  config: "artifacts/simnet/check-config.json",
  probe: "artifacts/simnet/probe-rpc.json",
  utxos: "artifacts/simnet/escrow-utxos.json",
  unsignedPreview: "artifacts/simnet/unsigned-release-preview.json",
};

const paths = {
  config: process.env.SIMNET_CONFIG_ARTIFACT_PATH || defaultPaths.config,
  probe: process.env.SIMNET_PROBE_ARTIFACT_PATH || defaultPaths.probe,
  utxos: process.env.SIMNET_UTXO_INSPECTOR_OUTPUT_PATH || defaultPaths.utxos,
  unsignedPreview: process.env.SIMNET_PREVIEW_OUTPUT_PATH || defaultPaths.unsignedPreview,
};

const results = {
  config: validateOptionalArtifact(paths.config, validateConfigArtifact),
  probe: validateOptionalArtifact(paths.probe, validateProbeArtifact),
  utxos: validateOptionalArtifact(paths.utxos, validateUtxoArtifact),
  unsignedPreview: validateOptionalArtifact(paths.unsignedPreview, validateUnsignedPreviewArtifact),
};

const blockers = Object.entries(results).flatMap(([name, result]) => result.ok ? [] : result.blockers.map((blocker) => `${name}: ${blocker}`));
const presentArtifacts = Object.values(results).filter((result) => result.present).length;
const report = {
  ok: blockers.length === 0 && presentArtifacts > 0,
  network: "simnet",
  paths,
  results,
  blockers: presentArtifacts === 0 ? ["No simnet proof artifacts were found at the configured paths."] : blockers,
  safety: [
    "This validator reads local JSON artifacts only.",
    "It does not call RPC, sign, unlock wallets, import/export private keys, broadcast, or execute liquidation.",
  ],
  createdAt: new Date().toISOString(),
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);

function validateOptionalArtifact(path, validator) {
  if (!existsSync(path)) {
    return { ok: true, present: false, path, blockers: [], warnings: ["Artifact not found; skipping optional validation."] };
  }

  try {
    const artifact = JSON.parse(readFileSync(path, "utf8"));
    const blockers = validator(artifact);
    return { ok: blockers.length === 0, present: true, path, blockers, warnings: [] };
  } catch (error) {
    return { ok: false, present: true, path, blockers: [error instanceof Error ? error.message : "Artifact could not be parsed."], warnings: [] };
  }
}

function validateConfigArtifact(artifact) {
  const blockers = commonArtifactBlockers(artifact);
  if (artifact.readyForWalletRpcProbe !== true) blockers.push("readyForWalletRpcProbe must be true.");
  if (!Array.isArray(artifact.walletRoles) || !includesAll(artifact.walletRoles, ["borrower", "lender", "arbiter"])) {
    blockers.push("walletRoles must include borrower, lender, and arbiter.");
  }
  return blockers;
}

function validateProbeArtifact(artifact) {
  const blockers = commonArtifactBlockers(artifact);
  if (!Array.isArray(artifact.probes)) blockers.push("probes must be an array.");
  if (Array.isArray(artifact.probes)) {
    for (const role of ["borrower", "lender", "arbiter"]) {
      const probe = artifact.probes.find((item) => item?.role === role);
      if (!probe) blockers.push(`Missing ${role} wallet probe.`);
      if (probe && probe.ok !== true) blockers.push(`${role} wallet probe must be ok.`);
    }
  }
  return blockers;
}

function validateUtxoArtifact(artifact) {
  const blockers = commonArtifactBlockers(artifact);
  if (!artifact.escrowAddress) blockers.push("escrowAddress is required.");
  if (!Number.isFinite(artifact.selectedUtxoCount) || artifact.selectedUtxoCount < 1) blockers.push("selectedUtxoCount must be at least 1.");
  if (!Number.isFinite(artifact.selectedDcr) || artifact.selectedDcr <= 0) blockers.push("selectedDcr must be positive.");
  if (!Number.isFinite(artifact.spendableAfterFeeDcr) || artifact.spendableAfterFeeDcr <= 0) blockers.push("spendableAfterFeeDcr must be positive.");
  if (!Array.isArray(artifact.selectedUtxos) || artifact.selectedUtxos.length < 1) blockers.push("selectedUtxos must include at least one confirmed UTXO.");
  return blockers;
}

function validateUnsignedPreviewArtifact(artifact) {
  const blockers = commonArtifactBlockers(artifact);
  const tx = artifact.unsignedTransaction;
  if (!tx || typeof tx !== "object") return [...blockers, "unsignedTransaction is required."];
  if (tx.network !== "simnet") blockers.push("unsignedTransaction.network must be simnet.");
  if (tx.purpose !== "collateral_release" && tx.purpose !== "liquidation") blockers.push("unsignedTransaction.purpose must be collateral_release or liquidation.");
  if (!tx.fromAddress) blockers.push("unsignedTransaction.fromAddress is required.");
  if (!tx.toAddress) blockers.push("unsignedTransaction.toAddress is required.");
  if (!Number.isFinite(tx.amountDcr) || tx.amountDcr <= 0) blockers.push("unsignedTransaction.amountDcr must be positive.");
  if (!Number.isFinite(tx.estimatedFeeDcr) || tx.estimatedFeeDcr < 0) blockers.push("unsignedTransaction.estimatedFeeDcr must be non-negative.");
  if (tx.requiredSignatures !== 2 || tx.totalSigners !== 3) blockers.push("unsignedTransaction must preserve 2-of-3 signing metadata.");
  if (typeof tx.rawTransactionHex !== "string" || tx.rawTransactionHex.length === 0) blockers.push("unsignedTransaction.rawTransactionHex is required.");
  return blockers;
}

function commonArtifactBlockers(artifact) {
  const blockers = [];
  if (!artifact || typeof artifact !== "object") return ["Artifact must be a JSON object."];
  if (artifact.ok !== true) blockers.push("ok must be true.");
  if (artifact.network !== "simnet") blockers.push("network must be simnet.");
  if (Array.isArray(artifact.blockers) && artifact.blockers.length > 0) blockers.push("blockers must be empty.");
  return blockers;
}

function includesAll(values, expected) {
  return expected.every((value) => values.includes(value));
}
