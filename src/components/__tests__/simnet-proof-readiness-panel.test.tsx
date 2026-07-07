import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createHeadlessLoanLifecycleRecord, type HeadlessLoanLifecycleRecord } from "@/lib/headless-loan-lifecycle";
import { SimnetProofReadinessPanel } from "../simnet-proof-readiness-panel";

describe("SimnetProofReadinessPanel", () => {
  it("renders proof checklist and hard broadcast block", () => {
    const markup = renderToStaticMarkup(<SimnetProofReadinessPanel record={readyRecord()} />);

    expect(markup).toContain("Simnet proof readiness");
    expect(markup).toContain("Proof checklist");
    expect(markup).toContain("Seed/refresh proof session");
    expect(markup).toContain("Broadcast blocked");
    expect(markup).toContain("No signing, no broadcast, no real funds");
    expect(markup).toContain("Unsigned release preview placeholder");
    expect(markup).toContain("Signing session placeholder");
    expect(markup).toContain("External signed-hex placeholder");
    expect(markup).toContain("Signature verification placeholder");
  });
});

function readyRecord(): HeadlessLoanLifecycleRecord {
  const now = "2026-07-07T16:00:00.000Z";
  const base = createHeadlessLoanLifecycleRecord({
    collateralDcr: 120,
    borrowAmount: 1000,
    borrowAsset: "USDC",
    borrowerAcceptedQuote: true,
    borrowerAcceptedPartialFunding: true,
    repaymentAmount: 1100,
    now,
  });

  return {
    ...base,
    collateralLock: { ...base.collateralLock, status: "locked", updatedAt: now },
    dcrPlatformFeeOutput: { ...base.dcrPlatformFeeOutput, status: "detected", updatedAt: now },
    repaymentDetection: { ...base.repaymentDetection, status: "detected", updatedAt: now },
    collateralRelease: { ...base.collateralRelease, status: "ready", updatedAt: now },
    arbiterReview: { ...base.arbiterReview, status: "resolved", updatedAt: now },
    evidenceBundle: {
      ...base.evidenceBundle,
      status: "prepared",
      updatedAt: now,
      timestamp: { ...base.evidenceBundle.timestamp, status: "verified", evidenceHash: "abc123", verificationStatus: "verified" },
    },
  };
}
