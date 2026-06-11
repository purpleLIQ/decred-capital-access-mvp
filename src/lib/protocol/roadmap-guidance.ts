import type { ScenarioReviewReport } from "../scenario-report";

export type ProtocolRoadmapTrack =
  | "supplier_funding"
  | "platform_fee"
  | "watcher_confirmations"
  | "oracle_policy"
  | "evidence_commitments"
  | "collateral_templates"
  | "arbiter_review"
  | "fallback_liquidation"
  | "treasury_request_research";

export type ProtocolRoadmapCurrentStatus = "complete" | "partial" | "blocked" | "not_started";
export type ProtocolRoadmapScenarioStatus = "pass" | "warning" | "blocked";

export interface ProtocolRoadmapGuidance {
  track: ProtocolRoadmapTrack;
  label: string;
  roadmapPhase: string;
  currentImplementationStatus: ProtocolRoadmapCurrentStatus;
  scenarioStatus: ProtocolRoadmapScenarioStatus;
  nextBuildStep: string;
  notes: string[];
}

export function createProtocolRoadmapGuidance(report: ScenarioReviewReport): ProtocolRoadmapGuidance[] {
  const fundingStatus = reportCheckStatus(report, "funding-state");
  const supplierCountStatus = reportCheckStatus(report, "supplier-count");
  const collateralTemplateStatus = reportCheckStatus(report, "collateral-template");
  const collateralObservationStatus = reportCheckStatus(report, "collateral-observation");
  const disbursementStatus = reportCheckStatus(report, "disbursement-observations");
  const evidenceRecordStatus = reportCheckStatus(report, "evidence-record");
  const evidenceHashStatus = reportCheckStatus(report, "evidence-hash");

  return [
    {
      track: "supplier_funding",
      label: "Supplier funding",
      roadmapPhase: "supplier offer UX",
      currentImplementationStatus: fundingStatus === "pass" && supplierCountStatus === "pass" ? "partial" : "blocked",
      scenarioStatus: toRoadmapScenarioStatus(worstStatus([fundingStatus, supplierCountStatus])),
      nextBuildStep: "Connect supplier fills to the borrower-facing quote and demo flow.",
      notes: [
        "Protocol funding state and fixture fills exist.",
        "Near-term work should make supplier fill progress visible to borrowers.",
      ],
    },
    {
      track: "platform_fee",
      label: "Platform fee",
      roadmapPhase: "borrower quote integration",
      currentImplementationStatus: "partial",
      scenarioStatus: "pass",
      nextBuildStep: "Surface the 1% DCR platform fee clearly in borrower quotes and summaries.",
      notes: [
        "Protocol quote output includes platform and reserve split.",
        "The borrower flow should show fee impact before loan creation.",
      ],
    },
    {
      track: "watcher_confirmations",
      label: "Watcher confirmations",
      roadmapPhase: "watcher-backed confirmation UI",
      currentImplementationStatus: collateralObservationStatus === "pass" && disbursementStatus === "pass" ? "partial" : "blocked",
      scenarioStatus: toRoadmapScenarioStatus(worstStatus([collateralObservationStatus, disbursementStatus])),
      nextBuildStep: "Expose confirmation status in borrower and supplier views before deeper chain integration.",
      notes: [
        "Fixture observations are confirmed.",
        "UI should distinguish pending, confirmed, and review states.",
      ],
    },
    {
      track: "oracle_policy",
      label: "Oracle policy",
      roadmapPhase: "oracle health in UI",
      currentImplementationStatus: "partial",
      scenarioStatus: "warning",
      nextBuildStep: "Connect oracle health, freshness, and deviation warnings to borrower and ops screens.",
      notes: [
        "Policy scaffolding exists, but product screens still need actionable health messaging.",
        "This should happen before deeper evidence and collateral review flows.",
      ],
    },
    {
      track: "evidence_commitments",
      label: "Evidence commitments",
      roadmapPhase: "evidence bundle review",
      currentImplementationStatus: evidenceRecordStatus === "pass" && evidenceHashStatus === "pass" ? "partial" : "blocked",
      scenarioStatus: toRoadmapScenarioStatus(worstStatus([evidenceRecordStatus, evidenceHashStatus])),
      nextBuildStep: "Add an evidence bundle review surface after borrower and supplier quote flows feel real.",
      notes: [
        "Anchored fixture record and hash commitment are present.",
        "Evidence review should remain read-only until the core product flow is clearer.",
      ],
    },
    {
      track: "collateral_templates",
      label: "Collateral templates",
      roadmapPhase: "collateral template review",
      currentImplementationStatus: collateralTemplateStatus === "pass" ? "partial" : "blocked",
      scenarioStatus: toRoadmapScenarioStatus(collateralTemplateStatus),
      nextBuildStep: "Add template review only after quote, supplier fill, and fee visibility are wired into the demo flow.",
      notes: [
        "Unsigned preview templates exist for the fixture.",
        "The next useful integration is product-facing context, not more standalone template modeling.",
      ],
    },
    {
      track: "arbiter_review",
      label: "Arbiter review",
      roadmapPhase: "arbiter case workflow",
      currentImplementationStatus: "partial",
      scenarioStatus: "warning",
      nextBuildStep: "Defer full arbiter workflow until borrower/supplier positions and repayment allocation are visible.",
      notes: [
        "Arbiter case scaffolding exists.",
        "Operator decisions need richer product context before becoming a useful workflow.",
      ],
    },
    {
      track: "fallback_liquidation",
      label: "Fallback liquidation",
      roadmapPhase: "simnet automatic fallback liquidation",
      currentImplementationStatus: "blocked",
      scenarioStatus: "blocked",
      nextBuildStep: "Wait until oracle, watcher, evidence, arbiter, and collateral-template flows are proven in simnet.",
      notes: [
        "This path is intentionally blocked for the current product stage.",
        "Do not prioritize automatic fallback work before borrower and supplier UX integration.",
      ],
    },
    {
      track: "treasury_request_research",
      label: "Treasury request research",
      roadmapPhase: "ecosystem funding research",
      currentImplementationStatus: "not_started",
      scenarioStatus: "warning",
      nextBuildStep: "Capture product proof points from borrower/supplier demo flows before drafting request materials.",
      notes: [
        "Research depends on a credible demo narrative.",
        "Near-term proof should come from quote, supplier fill, platform fee, and position visibility.",
      ],
    },
  ];
}

function reportCheckStatus(report: ScenarioReviewReport, checkId: string) {
  return report.sections.flatMap((section) => section.checks).find((check) => check.id === checkId)?.status ?? "review";
}

function worstStatus(statuses: Array<"pass" | "review" | "blocked">) {
  if (statuses.includes("blocked")) return "blocked";
  if (statuses.includes("review")) return "review";
  return "pass";
}

function toRoadmapScenarioStatus(status: "pass" | "review" | "blocked"): ProtocolRoadmapScenarioStatus {
  if (status === "review") return "warning";
  return status;
}
