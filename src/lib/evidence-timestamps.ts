export type EvidenceTimestampStatus = "not_prepared" | "prepared" | "submitted" | "anchored" | "verified" | "failed";

export type EvidenceTimestampProvider = "dcrtime" | "decred_wallet_timestamp" | "manual" | "none";

export type EvidenceDigestAlgorithm = "sha256_placeholder" | "blake256" | "merkle_root";

export type EvidenceTimestampVerificationStatus = "not_checked" | "pending" | "verified" | "failed";

export interface EvidenceTimestampAnchor {
  evidenceHash: string;
  digestAlgorithm: EvidenceDigestAlgorithm;
  provider: EvidenceTimestampProvider;
  status: EvidenceTimestampStatus;
  submittedAt?: string;
  anchoredAt?: string;
  chainTimestamp?: string;
  txid?: string;
  merkleRoot?: string;
  merklePathPlaceholder?: string;
  verificationStatus: EvidenceTimestampVerificationStatus;
  publicSummaryId: string;
  auditNote: string;
}

export interface EvidenceTimestampEventPayload {
  evidenceHash?: string;
  digestAlgorithm?: EvidenceDigestAlgorithm;
  provider?: EvidenceTimestampProvider;
  submittedAt?: string;
  anchoredAt?: string;
  chainTimestamp?: string;
  txid?: string;
  merkleRoot?: string;
  merklePathPlaceholder?: string;
  verificationStatus?: EvidenceTimestampVerificationStatus;
  publicSummaryId?: string;
  auditNote?: string;
}

export const emptyEvidenceTimestampAnchor: EvidenceTimestampAnchor = {
  evidenceHash: "",
  digestAlgorithm: "sha256_placeholder",
  provider: "none",
  status: "not_prepared",
  verificationStatus: "not_checked",
  publicSummaryId: "not-prepared",
  auditNote: "No public evidence timestamp anchor has been prepared. Full evidence remains off-chain and private fields are excluded.",
};

export function updateEvidenceTimestampAnchor(
  current: EvidenceTimestampAnchor | undefined,
  patch: EvidenceTimestampEventPayload,
  status: EvidenceTimestampStatus,
): EvidenceTimestampAnchor {
  const base = current ?? emptyEvidenceTimestampAnchor;

  return {
    evidenceHash: patch.evidenceHash ?? base.evidenceHash,
    digestAlgorithm: patch.digestAlgorithm ?? base.digestAlgorithm,
    provider: patch.provider ?? base.provider,
    status,
    submittedAt: patch.submittedAt ?? base.submittedAt,
    anchoredAt: patch.anchoredAt ?? base.anchoredAt,
    chainTimestamp: patch.chainTimestamp ?? base.chainTimestamp,
    txid: patch.txid ?? base.txid,
    merkleRoot: patch.merkleRoot ?? base.merkleRoot,
    merklePathPlaceholder: patch.merklePathPlaceholder ?? base.merklePathPlaceholder,
    verificationStatus: patch.verificationStatus ?? base.verificationStatus,
    publicSummaryId: patch.publicSummaryId ?? base.publicSummaryId,
    auditNote: patch.auditNote ?? base.auditNote,
  };
}
