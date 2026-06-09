import { runSteps } from "./run-steps.mjs";

runSteps([
  "npm run audit",
  "npm run safety:check",
  "npm run simnet:fixture-proof",
  "npm test",
  "npm run lint",
  "npm run build",
]);
