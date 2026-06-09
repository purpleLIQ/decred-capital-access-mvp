import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const commands = [
  ["Current branch", "git branch --show-current"],
  ["HEAD", "git rev-parse HEAD"],
  ["Latest main", "git rev-parse main"],
  ["Upstream", "git rev-parse --abbrev-ref --symbolic-full-name @{u}"],
  ["Git status", "git status --short"],
  ["Node", "node --version"],
  ["npm", "npm --version"],
];

console.log("# Local workflow status\n");

for (const [label, command] of commands) {
  console.log(`## ${label}`);
  console.log(run(command) || "(none)");
  console.log();
}

console.log("## npm scripts");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
for (const script of Object.keys(pkg.scripts ?? {}).sort()) {
  console.log(`- ${script}: ${pkg.scripts[script]}`);
}

console.log("\n## Recent commits");
console.log(run("git log --oneline -5") || "(none)");

function run(command) {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    }).trim();
  } catch (error) {
    const stderr = error.stderr?.toString().trim();
    return stderr ? `(unavailable: ${stderr})` : "(unavailable)";
  }
}
