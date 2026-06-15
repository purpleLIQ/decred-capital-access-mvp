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

  it("shows supplier positions derived from accepted quote fills", () => {
    const markup = renderToStaticMarkup(<SupplierOffersDemo />);

    expect(markup).toContain("Accepted quote lifecycle");
    expect(markup).toContain("Supplier position previews");
    expect(markup).toContain("Positions are generated from borrower quote fills");
    expect(markup).toContain("DCL-ACCEPTED-001");
    expect(markup).toContain("Repayment preview allocates across those positions by supplier total due.");
  });

  it("shows repayment allocation across supplier positions", () => {
    const markup = renderToStaticMarkup(<SupplierOffersDemo />);

    expect(markup).toContain("Repayment allocation preview");
    expect(markup).toContain("Pro-rata supplier repayment");
    expect(markup).toContain("Demo repayment amount");
    expect(markup).toContain("Repayment is allocated pro-rata across supplier position total due.");
  });
});
