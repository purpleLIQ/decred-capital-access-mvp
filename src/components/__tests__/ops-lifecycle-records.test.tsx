import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OpsLifecycleRecords } from "../ops-lifecycle-records";

// The empty shell keeps existing visibility copy stable while the per-record
// operator fixture action renders only when lifecycle records are returned by
// the shared store/API path.
describe("OpsLifecycleRecords", () => {
  it("renders lifecycle store visibility shell", () => {
    const markup = renderToStaticMarkup(<OpsLifecycleRecords />);

    expect(markup).toContain("Headless loan records");
    expect(markup).toContain("same store/API boundary used by borrower lookup");
    expect(markup).toContain("Refresh records");
    expect(markup).toContain("No lifecycle records saved yet");
    expect(markup).toContain("Lifecycle event history");
    expect(markup).toContain("Recent transitions");
  });

  it("keeps operator fixture scenario copy in the component source path", async () => {
    const source = await import("node:fs/promises").then((fs) => fs.readFile("src/components/ops-lifecycle-records.tsx", "utf8"));

    expect(source).toContain("Operator-only fixture health scenario");
    expect(source).toContain("Submit scenario");
    expect(source).toContain("/api/oracle-liquidation-health/fixture-scenario");
    expect(source).toContain("Automatic liquidation remains blocked");
    expect(source).toContain("SimnetProofReadinessPanel");
  });
});
