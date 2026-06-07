import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const rootDir = process.cwd();
const checkConfigScript = readFileSync(join(rootDir, "scripts/simnet-proof/check-config.mjs"), "utf8");
const probeRpcScript = readFileSync(join(rootDir, "scripts/simnet-proof/probe-rpc.mjs"), "utf8");

describe("simnet proof harness safety boundary", () => {
  it("keeps unsafe RPC methods blocked in config and probe scripts", () => {
    for (const method of ["sendrawtransaction", "signrawtransaction", "walletpassphrase", "importprivkey", "dumpprivkey"]) {
      expect(checkConfigScript).toContain(method);
      expect(probeRpcScript).toContain(method);
    }
  });

  it("limits the RPC probe to read-only wallet methods", () => {
    expect(probeRpcScript).toContain('allowedProbeMethods = new Set(["getblockchaininfo", "listunspent"]');
    expect(probeRpcScript).toContain('method: "listunspent"');
    expect(probeRpcScript).not.toContain('method: "sendrawtransaction"');
    expect(probeRpcScript).not.toContain('method: "signrawtransaction"');
  });

  it("does not include private-key, signing, or broadcast command helpers", () => {
    for (const script of [checkConfigScript, probeRpcScript]) {
      expect(script).not.toContain("walletpassphrase ");
      expect(script).not.toContain("signrawtransaction ");
      expect(script).not.toContain("sendrawtransaction ");
      expect(script).not.toContain("dumpprivkey ");
    }
  });
});
