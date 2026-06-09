import { runSteps } from "./run-steps.mjs";

runSteps([
  "npm run safety:check",
  "npm run test:protocol",
]);
