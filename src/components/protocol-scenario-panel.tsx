import { CheckCircle2 } from "lucide-react";

export interface DemoProtocolScenario {
  loanRequestId: string;
  borrowAsset: string;
  collateralAsset: string;
  fundingStatus: string;
  activationEligible: boolean;
  supplierCount: number;
  collateralTemplateStatus: string;
  collateralObservationStatus: string;
  disbursementObservationStatuses: string[];
  evidenceRecordStatus: string;
  evidenceCommitmentHash: string;
  platformFeeAmount: number;
  arbiterReserveAmount: number;
  notes: string[];
}

export function ProtocolScenarioPanel({ scenario }: { scenario?: DemoProtocolScenario }) {
  if (!scenario) {
    return null;
  }

  return (
    <div className="mt-4 rounded-2xl border border-[#70cbff]/15 bg-[#091440]/65 p-4 font-mono text-xs text-[#9bdfff] shadow-xl shadow-black/20">
      <div className="flex items-center gap-2 border-b border-[#70cbff]/10 pb-3 text-[#2ed6a1]">
        <CheckCircle2 className="h-4 w-4" />
        <span>protocol://fixture/{scenario.loanRequestId}</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <ProtocolStat label="Funding" value={scenario.fundingStatus} detail={scenario.activationEligible ? "activation eligible" : "waiting"} ok={scenario.activationEligible} />
        <ProtocolStat label="Collateral" value={scenario.collateralObservationStatus} detail={scenario.collateralTemplateStatus.replaceAll("_", " ")} ok={scenario.collateralObservationStatus === "confirmed"} />
        <ProtocolStat label="Evidence" value={scenario.evidenceRecordStatus} detail={shortHash(scenario.evidenceCommitmentHash)} ok={scenario.evidenceRecordStatus === "anchored"} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <ProtocolStat label="Borrow asset" value={scenario.borrowAsset} detail={`${scenario.collateralAsset} collateral`} ok />
        <ProtocolStat label="Suppliers" value={`${scenario.supplierCount}`} detail={`${scenario.disbursementObservationStatuses.length} watched`} ok={scenario.disbursementObservationStatuses.every((status) => status === "confirmed")} />
      </div>
      <p className="mt-3 text-[0.7rem] leading-5 text-white/55">{scenario.notes[0]}</p>
    </div>
  );
}

function ProtocolStat({ label, value, detail, ok }: { label: string; value: string; detail: string; ok: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border border-[#70cbff]/10 bg-black/20 p-3">
      <p className="truncate text-[0.65rem] uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className={ok ? "mt-2 truncate text-xl font-semibold text-[#9bf0d6]" : "mt-2 truncate text-xl font-semibold text-[#ffd88a]"}>{value}</p>
      <p className="mt-1 truncate text-white/45">{detail}</p>
    </div>
  );
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}
