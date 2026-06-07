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
const allowedMethods = new Set(["listunspent", "createrawtransaction"]);
const releasePurpose = "collateral_release";
const liquidationPurpose = "liquidation";

const purpose = envValue("SIMNET_PREVIEW_PURPOSE") ?? releasePurpose;
const blockers = validateInputs(purpose);

if (blockers.length > 0) {
  printAndExit({
    ok: false,
    network: "simnet",
    purpose,
    unsignedTransaction: null,
    blockers,
    safety: safetyNotes(),
  }, 1);
}

const loan = {
  id: envValue("SIMNET_PREVIEW_LOAN_ID") ?? "simnet_proof_loan",
  escrowAddress: mustEnv("SIMNET_PREVIEW_ESCROW_ADDRESS"),
  redeemScript: mustEnv("SIMNET_PREVIEW_REDEEM_SCRIPT"),
  collateralDcr: Number(mustEnv("SIMNET_PREVIEW_COLLATERAL_DCR")),
};
const destinationAddress = mustEnv("SIMNET_PREVIEW_DESTINATION_ADDRESS");
const minConfirmations = Number(envValue("SIMNET_PREVIEW_MIN_CONFIRMATIONS") ?? "1");
const estimatedFeeDcr = Number(envValue("SIMNET_PREVIEW_FEE_DCR") ?? "0.001");
const role = walletRoleForPurpose(purpose);

try {
  const wallet = walletConfig(role);
  const utxos = await callWalletRpc(wallet, "listunspent", [minConfirmations, 9999999, [loan.escrowAddress]]);
  const selectedUtxos = normalizeUtxos(utxos).filter((utxo) => utxo.amount > 0);

  if (selectedUtxos.length === 0) {
    printAndExit({
      ok: false,
      network: "simnet",
      purpose,
      unsignedTransaction: null,
      blockers: [`No confirmed simnet UTXOs found for escrow address ${loan.escrowAddress}.`],
      safety: safetyNotes(),
    }, 1);
  }

  const totalInputDcr = sumDcr(selectedUtxos);
  const amountDcr = Number((totalInputDcr - estimatedFeeDcr).toFixed(8));

  if (amountDcr <= 0) {
    printAndExit({
      ok: false,
      network: "simnet",
      purpose,
      unsignedTransaction: null,
      blockers: ["Selected simnet UTXOs do not cover the estimated unsigned transaction fee."],
      safety: safetyNotes(),
    }, 1);
  }

  const inputs = selectedUtxos.map((utxo) => ({ txid: utxo.txid, vout: utxo.vout }));
  const rawTransactionHex = await callWalletRpc(wallet, "createrawtransaction", [inputs, { [destinationAddress]: amountDcr }]);

  if (typeof rawTransactionHex !== "string" || rawTransactionHex.length === 0) {
    printAndExit({
      ok: false,
      network: "simnet",
      purpose,
      unsignedTransaction: null,
      blockers: ["createrawtransaction did not return unsigned raw transaction hex."],
      safety: safetyNotes(),
    }, 1);
  }

  const artifact = {
    ok: true,
    network: "simnet",
    purpose,
    walletRole: role,
    loanId: loan.id,
    escrowAddress: loan.escrowAddress,
    redeemScriptPresent: Boolean(loan.redeemScript),
    selectedUtxos: selectedUtxos.map((utxo) => ({ txid: utxo.txid, vout: utxo.vout, amount: utxo.amount, confirmations: utxo.confirmations ?? null })),
    unsignedTransaction: {
      id: `unsigned_${loan.id}_${purpose}`,
      network: "simnet",
      purpose,
      loanId: loan.id,
      fromAddress: loan.escrowAddress,
      toAddress: destinationAddress,
      amountDcr,
      estimatedFeeDcr,
      requiredSignatures: 2,
      totalSigners: 3,
      rawTransactionHex,
      warnings: [
        "Unsigned simnet transaction only. It has not been signed.",
        "Broadcast remains disabled until signed transaction validation and explicit operator action are implemented.",
      ],
    },
    blockers: [],
    safety: safetyNotes(),
    createdAt: new Date().toISOString(),
  };

  const outputPath = envValue("SIMNET_PREVIEW_OUTPUT_PATH");
  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  }

  printAndExit(artifact, 0);
} catch (error) {
  printAndExit({
    ok: false,
    network: "simnet",
    purpose,
    unsignedTransaction: null,
    blockers: [error instanceof Error ? error.message : "Unknown unsigned preview error."],
    safety: safetyNotes(),
  }, 1);
}

async function callWalletRpc(wallet, method, params) {
  assertAllowedMethod(method);

  const response = await fetch(wallet.url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${wallet.user}:${wallet.password}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ jsonrpc: "1.0", id: `simnet-preview-${wallet.role}-${method}`, method, params }),
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
    throw new Error(`RPC method ${method} is outside the unsigned transaction boundary.`);
  }

  if (!allowedMethods.has(normalized)) {
    throw new Error(`RPC method ${method} is not allowed by this unsigned preview CLI.`);
  }
}

function validateInputs(purpose) {
  const blockers = [];
  if (process.env.DCR_SIMNET_ENABLED?.trim() !== "true") blockers.push("DCR_SIMNET_ENABLED must be true for isolated simnet unsigned previews.");
  if (purpose !== releasePurpose && purpose !== liquidationPurpose) blockers.push("SIMNET_PREVIEW_PURPOSE must be collateral_release or liquidation.");

  for (const name of [
    "SIMNET_PREVIEW_ESCROW_ADDRESS",
    "SIMNET_PREVIEW_REDEEM_SCRIPT",
    "SIMNET_PREVIEW_COLLATERAL_DCR",
    "SIMNET_PREVIEW_DESTINATION_ADDRESS",
  ]) {
    if (!envValue(name)) blockers.push(`Missing ${name}.`);
  }

  const role = purpose === liquidationPurpose ? "LENDER" : "BORROWER";
  for (const name of [`DCRWALLET_SIMNET_${role}_RPC_URL`, `DCRWALLET_SIMNET_${role}_RPC_USER`, `DCRWALLET_SIMNET_${role}_RPC_PASSWORD`]) {
    if (!envValue(name)) blockers.push(`Missing ${name}.`);
  }

  for (const [name, value] of [
    ["SIMNET_PREVIEW_COLLATERAL_DCR", envValue("SIMNET_PREVIEW_COLLATERAL_DCR")],
    ["SIMNET_PREVIEW_FEE_DCR", envValue("SIMNET_PREVIEW_FEE_DCR") ?? "0.001"],
    ["SIMNET_PREVIEW_MIN_CONFIRMATIONS", envValue("SIMNET_PREVIEW_MIN_CONFIRMATIONS") ?? "1"],
  ]) {
    if (!Number.isFinite(Number(value)) || Number(value) < 0) blockers.push(`${name} must be a non-negative number.`);
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
    return [{ txid: item.txid, vout: item.vout, amount: item.amount, confirmations: typeof item.confirmations === "number" ? item.confirmations : undefined }];
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

function printAndExit(report, code) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(code);
}

function safetyNotes() {
  return [
    "This command builds an unsigned simnet preview only.",
    "It does not sign, unlock wallets, import/export private keys, broadcast, or execute liquidation.",
  ];
}
