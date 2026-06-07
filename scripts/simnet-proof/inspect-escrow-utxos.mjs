#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const blockedRpcMethods = new Set([
  "sendrawtransaction",
  "signrawtransaction",
  "signrawtransactionwithwallet",
  "walletpassphrase",
  "walletlock",
  "importprivkey",
  "dumpprivkey",
  "dumpwallet",
]);
const allowedMethods = new Set(["listunspent"]);
const releasePurpose = "collateral_release";
const liquidationPurpose = "liquidation";

const purpose = envValue("SIMNET_PREVIEW_PURPOSE") ?? releasePurpose;
const minConfirmations = numberEnv("SIMNET_PREVIEW_MIN_CONFIRMATIONS", 1);
const estimatedFeeDcr = numberEnv("SIMNET_PREVIEW_FEE_DCR", 0.001);
const escrowAddress = envValue("SIMNET_PREVIEW_ESCROW_ADDRESS");
const role = walletRoleForPurpose(purpose);
const blockers = validateInputs({ purpose, escrowAddress, minConfirmations, estimatedFeeDcr, role });

if (blockers.length > 0) {
  printAndExit(report({ purpose, role, escrowAddress, blockers }), 1);
}

try {
  const wallet = walletConfig(role);
  const rpcUtxos = await callWalletRpc(wallet, "listunspent", [0, 9999999, [escrowAddress]]);
  const utxos = normalizeUtxos(rpcUtxos);
  const confirmedUtxos = utxos.filter((utxo) => (utxo.confirmations ?? 0) >= minConfirmations && utxo.amount > 0);
  const totalDcr = sumDcr(utxos);
  const selectedDcr = sumDcr(confirmedUtxos);
  const spendableAfterFeeDcr = Number((selectedDcr - estimatedFeeDcr).toFixed(8));
  const runtimeBlockers = [];

  if (confirmedUtxos.length === 0) {
    runtimeBlockers.push(`No confirmed simnet UTXOs found for escrow address ${escrowAddress}.`);
  }

  if (confirmedUtxos.length > 0 && spendableAfterFeeDcr <= 0) {
    runtimeBlockers.push("Confirmed escrow UTXOs do not cover the estimated fee.");
  }

  const artifact = report({
    purpose,
    role,
    escrowAddress,
    blockers: runtimeBlockers,
    utxos,
    selectedUtxos: confirmedUtxos,
    totalDcr,
    selectedDcr,
    estimatedFeeDcr,
    spendableAfterFeeDcr,
  });

  const outputPath = envValue("SIMNET_UTXO_INSPECTOR_OUTPUT_PATH");
  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  }

  printAndExit(artifact, artifact.ok ? 0 : 1);
} catch (error) {
  printAndExit(report({
    purpose,
    role,
    escrowAddress,
    blockers: [error instanceof Error ? error.message : "Unknown escrow UTXO inspection error."],
  }), 1);
}

async function callWalletRpc(wallet, method, params) {
  assertAllowedMethod(method);

  const response = await fetch(wallet.url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${wallet.user}:${wallet.password}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ jsonrpc: "1.0", id: `simnet-utxo-${wallet.role}-${method}`, method, params }),
  });

  if (!response.ok) {
    throw new Error(`${wallet.role} wallet RPC ${method} failed with HTTP ${response.status}.`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error.message ?? `${wallet.role} wallet RPC ${method} failed.`);
  }

  return payload.result;
}

function assertAllowedMethod(method) {
  const normalized = method.toLowerCase();
  if (blockedRpcMethods.has(normalized)) {
    throw new Error(`RPC method ${method} is outside the read-only escrow inspection boundary.`);
  }

  if (!allowedMethods.has(normalized)) {
    throw new Error(`RPC method ${method} is not allowed by this escrow UTXO inspector.`);
  }
}

function validateInputs({ purpose, escrowAddress, minConfirmations, estimatedFeeDcr, role }) {
  const blockers = [];

  if (process.env.DCR_SIMNET_ENABLED?.trim() !== "true") {
    blockers.push("DCR_SIMNET_ENABLED must be true for isolated simnet escrow inspection.");
  }

  if (purpose !== releasePurpose && purpose !== liquidationPurpose) {
    blockers.push("SIMNET_PREVIEW_PURPOSE must be collateral_release or liquidation.");
  }

  if (!escrowAddress) blockers.push("Missing SIMNET_PREVIEW_ESCROW_ADDRESS.");
  if (!Number.isFinite(minConfirmations) || minConfirmations < 0) blockers.push("SIMNET_PREVIEW_MIN_CONFIRMATIONS must be a non-negative number.");
  if (!Number.isFinite(estimatedFeeDcr) || estimatedFeeDcr < 0) blockers.push("SIMNET_PREVIEW_FEE_DCR must be a non-negative number.");

  const rolePrefix = `DCRWALLET_SIMNET_${role.toUpperCase()}`;
  for (const name of [`${rolePrefix}_RPC_URL`, `${rolePrefix}_RPC_USER`, `${rolePrefix}_RPC_PASSWORD`]) {
    if (!envValue(name)) blockers.push(`Missing ${name}.`);
  }

  return blockers;
}

function walletConfig(role) {
  const prefix = `DCRWALLET_SIMNET_${role.toUpperCase()}`;
  return {
    role,
    url: mustEnv(`${prefix}_RPC_URL`),
    user: mustEnv(`${prefix}_RPC_USER`),
    password: mustEnv(`${prefix}_RPC_PASSWORD`),
  };
}

function walletRoleForPurpose(purpose) {
  return purpose === liquidationPurpose ? "lender" : "borrower";
}

function normalizeUtxos(value) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    if (typeof item.txid !== "string" || typeof item.vout !== "number" || typeof item.amount !== "number") return [];

    return [{
      txid: item.txid,
      vout: item.vout,
      amount: item.amount,
      confirmations: typeof item.confirmations === "number" ? item.confirmations : null,
      spendable: typeof item.spendable === "boolean" ? item.spendable : null,
      address: typeof item.address === "string" ? item.address : null,
    }];
  });
}

function sumDcr(utxos) {
  return Number(utxos.reduce((total, utxo) => total + utxo.amount, 0).toFixed(8));
}

function envValue(name) {
  const value = process.env[name]?.trim();
  return value || null;
}

function mustEnv(name) {
  const value = envValue(name);
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function numberEnv(name, fallback) {
  const value = envValue(name);
  if (!value) return fallback;
  return Number(value);
}

function report({
  purpose,
  role,
  escrowAddress,
  blockers,
  utxos = [],
  selectedUtxos = [],
  totalDcr = 0,
  selectedDcr = 0,
  estimatedFeeDcr = numberEnv("SIMNET_PREVIEW_FEE_DCR", 0.001),
  spendableAfterFeeDcr = 0,
}) {
  return {
    ok: blockers.length === 0,
    network: "simnet",
    purpose,
    walletRole: role,
    escrowAddress: escrowAddress ?? null,
    minConfirmations,
    utxoCount: utxos.length,
    selectedUtxoCount: selectedUtxos.length,
    totalDcr,
    selectedDcr,
    estimatedFeeDcr,
    spendableAfterFeeDcr,
    utxos,
    selectedUtxos,
    blockers,
    safety: [
      "This command inspects escrow UTXOs only.",
      "It calls listunspent only and does not build, sign, unlock wallets, import/export private keys, broadcast, or execute liquidation.",
    ],
    createdAt: new Date().toISOString(),
  };
}

function printAndExit(output, code) {
  console.log(JSON.stringify(output, null, 2));
  process.exit(code);
}
