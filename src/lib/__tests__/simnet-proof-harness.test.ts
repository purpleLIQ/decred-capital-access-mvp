import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const rootDir = process.cwd();
const checkConfigScript = readFileSync(join(rootDir, "scripts/simnet-proof/check-config.mjs"), "utf8");
const probeRpcScript = readFileSync(join(rootDir, "scripts/simnet-proof/probe-rpc.mjs"), "utf8");
const unsignedPreviewScript = readFileSync(join(rootDir, "scripts/simnet-proof/build-unsigned-preview.mjs"), "utf8");

describe("simnet proof harness safety boundary", () => {
  it("keeps unsafe RPC methods blocked in all harness scripts", () => {
    for (const method of ["sendrawtransaction", "signrawtransaction", "walletpassphrase", "importprivkey", "dumpprivkey"]) {
      expect(checkConfigScript).toContain(method);
      expect(probeRpcScript).toContain(method);
      expect(unsignedPreviewScript).toContain(method);
    }
  });

  it("limits the RPC probe to read-only wallet methods", () => {
    expect(probeRpcScript).toContain('allowedProbeMethods = new Set(["getblockchaininfo", "listunspent"]');
    expect(probeRpcScript).toContain('method: "listunspent"');
    expect(probeRpcScript).not.toContain('method: "sendrawtransaction"');
    expect(probeRpcScript).not.toContain('method: "signrawtransaction"');
  });

  it("limits the unsigned preview CLI to unsigned transaction construction", () => {
    expect(unsignedPreviewScript).toContain('allowedMethods = new Set(["listunspent", "createrawtransaction"]');
    expect(unsignedPreviewScript).toContain('"createrawtransaction"');
    expect(unsignedPreviewScript).not.toContain('method: "sendrawtransaction"');
    expect(unsignedPreviewScript).not.toContain('method: "signrawtransaction"');
    expect(unsignedPreviewScript).toContain("It does not sign, unlock wallets, import/export private keys, broadcast, or execute liquidation.");
  });

  it("does not include private-key, signing, or broadcast command helpers", () => {
    for (const script of [checkConfigScript, probeRpcScript, unsignedPreviewScript]) {
      expect(script).not.toContain("walletpassphrase ");
      expect(script).not.toContain("signrawtransaction ");
      expect(script).not.toContain("sendrawtransaction ");
      expect(script).not.toContain("dumpprivkey ");
    }
  });
});
