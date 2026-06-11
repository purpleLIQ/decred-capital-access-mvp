import type { ScenarioReviewReport } from "../scenario-report";

export type ProtocolRoadmapTrackStatus = "complete" | "partial" | "blocked" | "not_started";
export type ProtocolRoadmapScenarioStatus = "pass" | "warning" | "blocked";

export interface ProtocolRoadmapGuidance {
  track: string;
  roadmapPhase: string;
  currentStatus: ProtocolRoadmapTrackStatus;
  scenarioStatus: ProtocolRoadmapScenarioStatus;
  nextBuildStep: string;
  notes: string[];
}

export function createProtocolRoadmapGuidance(report: ScenarioReviewReport): ProtocolRoadmapGuidance[] {
  return [
    {
      track: "supplier funding",
      roadmapPhase: "supplier offer UX",
      currentStatus: "partial",
      scenarioStatus: statusFromCheck(report, "supplier-count"),
      nextBuildStep: "connect supplier fills to the borrower-facing quote/demo flow",
      notes: [
        "Protocol state machine and fixture fills exist.",
        "Near-term priority is showing supplier-side liquidity in the product flow.",
      ],
    },
    {
      track: "platform fee",
      roadmapPhase: "borrower quote integration",
      currentStatus: "partial",
      scenarioStatus: "pass",
      nextBuildStep: "surface the 1% DCR platform fee clearly in the borrower quote flow",
      notes: [
        "Fee math is present in the scenario quote and adapter.",
        "The borrower experience should show the fee before deeper protocol execution work continues.",
      ],
    },
    {
      track: "watcher confirmations",
      roadmapPhase: "watcher-backed confirmations in UI",
      currentStatus: "partial",
      scenarioStatus: worstStatus([statusFromCheck(report, "collateral-observation"), statusFromCheck(report, "disbursement-observations")]),
      nextBuildStep: "connect watcher confirmation state to borrower and supplier-visible progress indicators",
      notes: [
        "Fixture watchers are summarized in the report.",
        "Product UI should explain when funding and collateral confirmations are observed or still pending.",
      ],
    },
    {
      track: "oracle policy",
      roadmapPhase: "oracle freshness/deviation handling in UI",
      currentStatus: "partial",
      scenarioStatus: "pass",
      nextBuildStep: "show oracle health and threshold warnings in borrower quote and ops views",
      notes: [
        "Oracle policy scaffolding exists and should influence visible quote risk messaging.",
        "Do not deepen oracle internals until quote and supplier UX consume current health signals.",
      ],
    },
    {
      track: "evidence commitments",
      roadmapPhase: "evidence bundle review",
      currentStatus: "partial",
      scenarioStatus: worstStatus([statusFromCheck(report, "evidence-record"), statusFromCheck(report, "evidence-hash")]),
      nextBuildStep: "surface evidence bundle review state in ops before adding more evidence formats",
      notes: [
        "Evidence hash and anchored record checks are present.",
        "The next product need is clear operator review, not more detached evidence models.",
      ],
    },
    {
      track: "collateral templates",
      roadmapPhase: "collateral template review",
      currentStatus: "partial",
      scenarioStatus: statusFromCheck(report, "collateral-template"),
      nextBuildStep: "show unsigned collateral template readiness in borrower and ops review surfaces",
      notes: [
        "Template readiness is in the report.",
        "The product should make readiness and blockers legible before execution work expands.",
      ],
    },
    {
      track: "arbiter review",
      roadmapPhase: "arbiter case workflow",
      currentStatus: "partial",
      scenarioStatus: "warning",
      nextBuildStep: "connect arbiter case summary to the ops scenario page after borrower/supplier integration lands",
      notes: [
        "Arbiter scaffolding exists, but it is not the immediate product bottleneck.",
        "Return here after borrower quote, supplier fill, and fee visibility are integrated.",
      ],
    },
    {
      track: "fallback liquidation",
      roadmapPhase: "simnet automatic fallback liquidation",
      currentStatus: "blocked",
      scenarioStatus: "blocked",
      nextBuildStep: "wait until oracle, watcher, evidence, arbiter, and collateral-template flows are proven in simnet",
      notes: [
        "This remains intentionally blocked for now.",
        "Near-term work should stay on borrower/supplier-visible integration.",
      ],
    },
    {
      track: "Treasury request research",
      roadmapPhase: "Treasury request preparation",
      currentStatus: "not_started",
      scenarioStatus: "warning",
      nextBuildStep: "capture product proof points from borrower quote, supplier fill, and fee visibility work for the funding narrative",
      notes: [
        "Research should be driven by demo proof points, not abstract protocol modules.",
        "Use the ops page as a source of project status while the product becomes more tangible.",
      ],
    },
  ];
}

function statusFromCheck(report: ScenarioReviewReport, checkId: string): ProtocolRoadmapScenarioStatus {
  const check = report.sections.flatMap((section) => section.checks).find((candidate) => candidate.id === checkId);

  if (!check) {
    return "warning";
  }

  if (check.status === "blocked") {
    return "blocked";
  }

  if (check.status === "review") {
    return "warning";
  }

  return "pass";
}

function worstStatus(statuses: ProtocolRoadmapScenarioStatus[]): ProtocolRoadmapScenarioStatus {
  if (statuses.includes("blocked")) {
    return "blocked";
  }

  if (statuses.includes("warning")) {
    return "warning";
  }

  return "pass";
}
