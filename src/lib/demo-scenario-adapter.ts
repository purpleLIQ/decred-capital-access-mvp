import { createProtocolFixtureScenario } from "./protocol/protocol-fixtures";

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

export function getDemoProtocolScenario(): DemoProtocolScenario {
  const scenario = createProtocolFixtureScenario();

  return {
    loanRequestId: scenario.loanRequest.id,
    borrowAsset: scenario.loanRequest.borrowAsset,
    collateralAsset: scenario.loanRequest.collateralAsset,
    fundingStatus: scenario.quote.fundingState.status,
    activationEligible: scenario.quote.activationEligible,
    supplierCount: scenario.fills.length,
    collateralTemplateStatus: scenario.collateralTemplate.status,
    collateralObservationStatus: scenario.collateralObservation.status,
    disbursementObservationStatuses: scenario.disbursementObservations.map((observation) => observation.status),
    evidenceRecordStatus: scenario.evidenceRecord.status,
    evidenceCommitmentHash: scenario.evidenceCommitment.commitmentHash,
    platformFeeAmount: scenario.quote.platformFee.platformAmount,
    arbiterReserveAmount: scenario.quote.platformFee.arbiterReserveAmount,
    notes: [
      "Read-only protocol scenario fixture.",
      "No execution path is exposed through this adapter.",
      "Designed for demo UI and API inspection only.",
    ],
  };
}
