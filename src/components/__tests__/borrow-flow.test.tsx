import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StoredBorrowerFlow } from "../stored-borrower-flow";

describe("StoredBorrowerFlow", () => {
  it("renders the accountless quote acceptance and lookup path", () => {
    const markup = renderToStaticMarkup(<StoredBorrowerFlow />);

    expect(markup).toContain("Quote. Accept. Save your loan reference.");
    expect(markup).toContain("Optional contact");
    expect(markup).toContain("This is not an account");
    expect(markup).toContain("Loan lookup");
    expect(markup).toContain("No borrower login required.");
    expect(markup).toContain("Accept and save");
  });
});
