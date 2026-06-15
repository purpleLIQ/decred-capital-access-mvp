import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OpsLifecycleRecords } from "../ops-lifecycle-records";

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
});
