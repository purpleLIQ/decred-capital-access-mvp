import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const forbiddenPatterns = [
  { label: "wallet unlock RPC", pattern: /wallet\s*pass\s*phrase/i },
  { label: "private key dump RPC", pattern: /dump\s*priv\s*key/i },
  { label: "private key import RPC", pattern: /import\s*priv\s*key/i },
  { label: "raw transaction broadcast RPC", pattern: /send\s*raw\s*transaction/i },
  { label: "raw transaction signing RPC", pattern: /sign\s*raw\s*transaction/i },
  { label: "mnemonic handling", pattern: /\bmnemonic\b/i },
  { label: "seed phrase handling", pattern: /\bseed phrase\b/i },
  { label: "extended private key handling", pattern: /\bxprv\b/i },
  { label: "mainnet broadcast claim", pattern: /mainnet\s+broadcast/i },
  { label: "production-ready claim", pattern: /production[-\s]?ready/i },
  { label: "mainnet-ready claim", pattern: /mainnet[-\s]?ready/i },
];

const excludedPathPrefixes = [
  "node_modules/",
  ".git/",
  ".next/",
  "coverage/",
  "scripts/safety/check-forbidden-patterns.mjs",
];

const includedExtensions = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".mjs",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".yml",
  ".yaml",
]);

const files = execSync("git ls-files", { encoding: "utf8" })
  .split("\n")
  .map((path) => path.trim())
  .filter(Boolean)
  .filter((path) => !excludedPathPrefixes.some((prefix) => path.startsWith(prefix)))
  .filter((path) => includedExtensions.has(getExtension(path)));

const findings = [];

for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");

  lines.forEach((line, index) => {
    const normalizedLine = line.replace(/\s+/g, " ");

    for (const forbidden of forbiddenPatterns) {
      if (forbidden.pattern.test(normalizedLine)) {
        findings.push({
          file,
          lineNumber: index + 1,
          label: forbidden.label,
          line: line.trim(),
        });
      }
    }
  });
}

if (findings.length > 0) {
  console.error("Forbidden safety patterns found:\n");

  for (const finding of findings) {
    console.error(`${finding.file}:${finding.lineNumber} - ${finding.label}`);
    console.error(`  ${finding.line}`);
  }

  console.error("\nThese patterns are blocked until they are explicitly reviewed and allowlisted.");
  process.exit(1);
}

console.log("No forbidden safety patterns found.");

function getExtension(path) {
  const index = path.lastIndexOf(".");
  return index === -1 ? "" : path.slice(index);
}
