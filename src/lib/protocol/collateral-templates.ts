import type { CollateralAsset } from "./assets";
import type { DecredEvidenceCommitmentRecord } from "./evidence";
import type { PlatformFeeBreakdown } from "./platform-fees";

export type CollateralTemplateNetwork = "decred_simnet" | "decred_testnet" | "decred_mainnet";
export type CollateralTemplateStatus = "draft" | "ready_for_unsigned_preview" | "blocked";
export type CollateralTemplateSpendPath = "borrower_release" | "arbiter_release" | "arbiter_liquidation_review" | "fallback_liquidation_review";

export interface CollateralParticipantKeys {
  borrowerPubkey: string;
  supplierPubkey: string;
  arbiterPubkey: string;
}

export interface CollateralTemplatePolicy {
  network: CollateralTemplateNetwork;
  requiredConfirmations: number;
  borrowerReleaseLockTimeBlocks: number;
  arbiterInterventionLockTimeBlocks: number;
  fallbackReviewLockTimeBlocks: number;
  allowMainnet: boolean;
}

export interface CollateralTemplateInput {
  id: string;
  loanId: string;
  collateralAsset: CollateralAsset;
  collateralAmount: number;
  escrowAddress: string;
  participantKeys: CollateralParticipantKeys;
  platformFee: PlatformFeeBreakdown;
  platformFeeAddress: string;
  arbiterReserveAddress: string;
  evidenceCommitment?: DecredEvidenceCommitmentRecord;
  policy: CollateralTemplatePolicy;
  createdAt: string;
}

export interface CollateralTemplateOutput {
  kind: "collateral" | "platform_fee" | "arbiter_reserve" | "evidence_commitment";
  address?: string;
  amount?: number;
  payloadHex?: string;
  required: boolean;
}

export interface CollateralSpendPathTemplate {
  path: CollateralTemplateSpendPath;
  requiredApprovals: Array<"borrower" | "supplier" | "arbiter">;
  lockTimeBlocks?: number;
  enabled: boolean;
  blockers: string[];
}

export interface CollateralContractTemplate {
  id: string;
  loanId: string;
  network: CollateralTemplateNetwork;
  collateralAsset: CollateralAsset;
  collateralAmount: number;
  escrowAddress: string;
  outputs: CollateralTemplateOutput[];
  spendPaths: CollateralSpendPathTemplate[];
  requiredConfirmations: number;
  status: CollateralTemplateStatus;
  blockers: string[];
  createdAt: string;
}

export const DEFAULT_SIMNET_COLLATERAL_POLICY: CollateralTemplatePolicy = {
  network: "decred_simnet",
  requiredConfirmations: 6,
  borrowerReleaseLockTimeBlocks: 0,
  arbiterInterventionLockTimeBlocks: 144,
  fallbackReviewLockTimeBlocks: 288,
  allowMainnet: false,
};

export function createCollateralContractTemplate(input: CollateralTemplateInput): CollateralContractTemplate {
  const blockers = validateCollateralTemplateInput(input);
  const outputs = createCollateralOutputs(input);
  const spendPaths = createSpendPathTemplates(input.policy);

  return {
    id: input.id,
    loanId: input.loanId,
    network: input.policy.network,
    collateralAsset: input.collateralAsset,
    collateralAmount: input.collateralAmount,
    escrowAddress: input.escrowAddress,
    outputs,
    spendPaths,
    requiredConfirmations: input.policy.requiredConfirmations,
    status: blockers.length === 0 ? "ready_for_unsigned_preview" : "blocked",
    blockers,
    createdAt: input.createdAt,
  };
}

export function getEnabledSpendPaths(template: CollateralContractTemplate): CollateralSpendPathTemplate[] {
  return template.spendPaths.filter((path) => path.enabled);
}

function validateCollateralTemplateInput(input: CollateralTemplateInput): string[] {
  const blockers: string[] = [];

  if (input.collateralAsset !== "DCR") {
    blockers.push("Only DCR collateral templates are supported.");
  }

  if (input.policy.network === "decred_mainnet" && !input.policy.allowMainnet) {
    blockers.push("Mainnet collateral templates require explicit policy enablement.");
  }

  if (input.collateralAmount <= 0) {
    blockers.push("Collateral amount must be positive.");
  }

  if (input.platformFee.totalFeeAmount <= 0) {
    blockers.push("Platform fee output must be positive.");
  }

  if (input.platformFee.collateralAsset !== input.collateralAsset) {
    blockers.push("Platform fee asset must match collateral asset.");
  }

  if (!input.escrowAddress) {
    blockers.push("Escrow address is required.");
  }

  if (!input.platformFeeAddress) {
    blockers.push("Platform fee address is required.");
  }

  if (!input.arbiterReserveAddress) {
    blockers.push("Arbiter reserve address is required.");
  }

  for (const [label, pubkey] of Object.entries(input.participantKeys)) {
    if (!pubkey) {
      blockers.push(`${label} is required.`);
    }
  }

  return blockers;
}

function createCollateralOutputs(input: CollateralTemplateInput): CollateralTemplateOutput[] {
  const outputs: CollateralTemplateOutput[] = [
    {
      kind: "collateral",
      address: input.escrowAddress,
      amount: input.collateralAmount,
      required: true,
    },
    {
      kind: "platform_fee",
      address: input.platformFeeAddress,
      amount: input.platformFee.platformAmount,
      required: true,
    },
    {
      kind: "arbiter_reserve",
      address: input.arbiterReserveAddress,
      amount: input.platformFee.arbiterReserveAmount,
      required: true,
    },
  ];

  if (input.evidenceCommitment) {
    outputs.push({
      kind: "evidence_commitment",
      payloadHex: input.evidenceCommitment.commitmentPayloadHex,
      required: false,
    });
  }

  return outputs;
}

function createSpendPathTemplates(policy: CollateralTemplatePolicy): CollateralSpendPathTemplate[] {
  return [
    {
      path: "borrower_release",
      requiredApprovals: ["borrower", "supplier"],
      lockTimeBlocks: policy.borrowerReleaseLockTimeBlocks,
      enabled: true,
      blockers: [],
    },
    {
      path: "arbiter_release",
      requiredApprovals: ["borrower", "arbiter"],
      lockTimeBlocks: policy.arbiterInterventionLockTimeBlocks,
      enabled: true,
      blockers: [],
    },
    {
      path: "arbiter_liquidation_review",
      requiredApprovals: ["supplier", "arbiter"],
      lockTimeBlocks: policy.arbiterInterventionLockTimeBlocks,
      enabled: true,
      blockers: [],
    },
    {
      path: "fallback_liquidation_review",
      requiredApprovals: ["supplier", "arbiter"],
      lockTimeBlocks: policy.fallbackReviewLockTimeBlocks,
      enabled: false,
      blockers: ["Fallback liquidation requires future oracle, arbiter, watcher, transaction-template, evidence, and simnet proof gates."],
    },
  ];
}
