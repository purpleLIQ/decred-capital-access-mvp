import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BorrowFlow } from "../borrow-flow";

describe("BorrowFlow", () => {
  it("renders the accountless quote acceptance and lookup path", () => {
    const markup = renderToStaticMarkup(<BorrowFlow />);

    expect(markup).toContain("Accept quote without an account");
    expect(markup).toContain("Borrower contact is optional and only used for updates or recovery. It is not signup.");
    expect(markup).toContain("Loan lookup");
    expect(markup).toContain("Enter the public loan reference. No login required.");
    expect(markup).toContain("Accept quote");
  });
});
