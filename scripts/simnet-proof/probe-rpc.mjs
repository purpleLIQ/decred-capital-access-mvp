#!/usr/bin/env node

const walletRoles = ["BORROWER", "LENDER", "ARBITER"];
const allowedProbeMethods = new Set(["getblockchaininfo", "listunspent"]);
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

const failures = [];
const results = [];

if (process.env.DCR_SIMNET_ENABLED?.trim() !== "true") {
  failures.push("DCR_SIMNET_ENABLED must be true for RPC probing.");
}

for (const role of walletRoles) {
  const url = envValue(`DCRWALLET_SIMNET_${role}_RPC_URL`);
  const user = envValue(`DCRWALLET_SIMNET_${role}_RPC_USER`);
  const password = envValue(`DCRWALLET_SIMNET_${role}_RPC_PASSWORD`);

  if (!url || !user || !password) {
    failures.push(`Missing RPC URL/user/password for ${role.toLowerCase()} wallet.`);
    continue;
  }

  try {
    const listUnspent = await callWalletRpc({ role, url, user, password, method: "listunspent", params: [0, 9999999] });
    results.push({ role: role.toLowerCase(), method: "listunspent", ok: true, utxoCount: Array.isArray(listUnspent) ? listUnspent.length : null });
  } catch (error) {
    failures.push(`${role.toLowerCase()} listunspent probe failed: ${error.message}`);
    results.push({ role: role.toLowerCase(), method: "listunspent", ok: false, error: error.message });
  }
}

const report = {
  ok: failures.length === 0,
  network: "simnet",
  probes: results,
  allowedProbeMethods: [...allowedProbeMethods].sort(),
  blockedRpcMethods: [...blockedRpcMethods].sort(),
  failures,
  safety: [
    "This probe calls listunspent only.",
    "It does not call signing, wallet unlock, private-key import/export, or broadcast RPC methods.",
  ],
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);

async function callWalletRpc({ role, url, user, password, method, params }) {
  assertAllowedProbeMethod(method);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ jsonrpc: "1.0", id: `simnet-proof-${role.toLowerCase()}-${method}`, method, params }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error.message ?? `RPC ${method} failed`);
  }

  return payload.result;
}

function assertAllowedProbeMethod(method) {
  const normalized = method.toLowerCase();
  if (blockedRpcMethods.has(normalized)) {
    throw new Error(`RPC method ${method} is outside the unsigned/read-only simnet proof boundary.`);
  }

  if (!allowedProbeMethods.has(normalized)) {
    throw new Error(`RPC method ${method} is not allowed by this proof harness.`);
  }
}

function envValue(name) {
  const value = process.env[name]?.trim();
  return value || null;
}
