import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SupplierOffersDemo } from "../supplier-offers-demo";

describe("SupplierOffersDemo", () => {
  it("renders the supplier offer workflow shell", () => {
    const markup = renderToStaticMarkup(<SupplierOffersDemo />);

    expect(markup).toContain("Offer demo");
    expect(markup).toContain("Create offer");
    expect(markup).toContain("Supplier offers");
    expect(markup).toContain("Create demo offer");
    expect(markup).toContain("Edit +100 / +25bps");
    expect(markup).toContain("1,800 USDC");
    expect(markup).toContain("Matching active USDC capacity for a 30-day request.");
  });
});
