#!/usr/bin/env node

const walletRoles = ["BORROWER", "LENDER", "ARBITER"];
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

const requiredEnvVars = [
  "DCR_SIMNET_ENABLED",
  "DCRD_SIMNET_RPC_URL",
  "DCRD_SIMNET_RPC_USER",
  "DCRD_SIMNET_RPC_PASSWORD",
  ...walletRoles.flatMap((role) => [
    `DCRWALLET_SIMNET_${role}_RPC_URL`,
    `DCRWALLET_SIMNET_${role}_RPC_USER`,
    `DCRWALLET_SIMNET_${role}_RPC_PASSWORD`,
  ]),
];

const optionalEnvVars = [
  "DCRD_SIMNET_RPC_CERT_PATH",
  ...walletRoles.flatMap((role) => [`DCRWALLET_SIMNET_${role}_RPC_CERT_PATH`, `DCRWALLET_SIMNET_${role}_ACCOUNT`]),
];

const missing = requiredEnvVars.filter((name) => !envValue(name));
const urlProblems = [
  ...validateUrl("DCRD_SIMNET_RPC_URL"),
  ...walletRoles.flatMap((role) => validateUrl(`DCRWALLET_SIMNET_${role}_RPC_URL`)),
];
const enabled = envValue("DCR_SIMNET_ENABLED") === "true";
const blockers = [
  ...(!enabled ? ["DCR_SIMNET_ENABLED must be true for an isolated local simnet proof."] : []),
  ...(missing.length ? [`Missing required env vars: ${missing.join(", ")}.`] : []),
  ...urlProblems,
];

const report = {
  ok: blockers.length === 0,
  network: "simnet",
  readyForWalletRpcProbe: blockers.length === 0,
  requiredEnvVars: requiredEnvVars.map((name) => ({ name, present: Boolean(envValue(name)), secret: name.endsWith("PASSWORD") })),
  optionalEnvVars: optionalEnvVars.map((name) => ({ name, present: Boolean(envValue(name)), secret: false })),
  walletRoles: walletRoles.map((role) => role.toLowerCase()),
  blockedRpcMethods: [...blockedRpcMethods].sort(),
  blockers,
  safety: [
    "This harness checks config and unsigned/read-only RPC reachability only.",
    "It must not sign transactions, unlock wallets, export/import private keys, or broadcast transactions.",
  ],
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);

function envValue(name) {
  const value = process.env[name]?.trim();
  return value || null;
}

function validateUrl(name) {
  const value = envValue(name);
  if (!value) return [];

  try {
    const url = new URL(value);
    const blockers = [];

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      blockers.push(`${name} must use http:// or https://.`);
    }

    if (value.toLowerCase().includes("mainnet")) {
      blockers.push(`${name} must not point at a mainnet endpoint.`);
    }

    return blockers;
  } catch {
    return [`${name} must be a valid HTTP(S) URL.`];
  }
}
