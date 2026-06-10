import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OpsProtocolScenario } from "../ops-protocol-scenario";

describe("OpsProtocolScenario", () => {
  it("renders the read-only protocol scenario shell", () => {
    const markup = renderToStaticMarkup(<OpsProtocolScenario />);

    expect(markup).toContain("Read-only scenario");
    expect(markup).toContain("Protocol fixture");
    expect(markup).toContain("Refresh scenario");
    expect(markup).toContain("Loading protocol scenario");
  });
});
