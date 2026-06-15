import type { BorrowAsset } from "./protocol/assets";
import type { SupplierPositionPreview } from "./supplier-position-previews";

export type SupplierRepaymentAllocationStatus = "waiting_for_positions" | "unpaid" | "partially_repaid" | "repaid";

export interface SupplierRepaymentAllocationRow {
  positionId: string;
  supplierId: string;
  supplierOfferId: string;
  fillId: string;
  loanId: string;
  borrowerLoanRef: string;
  borrowAsset: BorrowAsset;
  principalDue: number;
  interestDue: number;
  totalDue: number;
  supplierShareBps: number;
  repaymentAllocated: number;
  repaymentReceived: number;
  remainingDue: number;
  status: SupplierRepaymentAllocationStatus;
}

export interface SupplierRepaymentAllocationPreview {
  loanId: string;
  borrowerLoanRef: string;
  borrowAsset: BorrowAsset | null;
  repaymentAmount: number;
  totalPrincipalDue: number;
  totalInterestDue: number;
  totalDue: number;
  totalAllocated: number;
  unallocatedAmount: number;
  remainingDue: number;
  status: SupplierRepaymentAllocationStatus;
  allocations: SupplierRepaymentAllocationRow[];
  notes: string[];
}

export function allocateRepaymentAcrossSupplierPositions(input: {
  positions: SupplierPositionPreview[];
  repaymentAmount: number;
}): SupplierRepaymentAllocationPreview {
  const positions = input.positions.filter((position) => position.totalDue > 0);
  const repaymentAmount = roundAssetAmount(Math.max(input.repaymentAmount, 0));
  const totalDue = roundAssetAmount(positions.reduce((sum, position) => sum + position.totalDue, 0));
  const totalPrincipalDue = roundAssetAmount(positions.reduce((sum, position) => sum + position.principal, 0));
  const totalInterestDue = roundAssetAmount(positions.reduce((sum, position) => sum + position.interestDue, 0));
  const outstandingDue = roundAssetAmount(
    positions.reduce((sum, position) => sum + Math.max(position.totalDue - position.repaymentReceived, 0), 0),
  );
  const allocatedPool = roundAssetAmount(Math.min(repaymentAmount, outstandingDue));
  let allocatedSoFar = 0;

  if (positions.length === 0 || totalDue <= 0) {
    return {
      loanId: "",
      borrowerLoanRef: "",
      borrowAsset: null,
      repaymentAmount,
      totalPrincipalDue: 0,
      totalInterestDue: 0,
      totalDue: 0,
      totalAllocated: 0,
      unallocatedAmount: repaymentAmount,
      remainingDue: 0,
      status: "waiting_for_positions",
      allocations: [],
      notes: [
        "No supplier positions are ready for repayment allocation.",
        "Create accepted supplier positions before showing repayment distribution.",
      ],
    };
  }

  const allocations = positions.map((position, index): SupplierRepaymentAllocationRow => {
    const isLast = index === positions.length - 1;
    const outstandingPositionDue = roundAssetAmount(Math.max(position.totalDue - position.repaymentReceived, 0));
    const proRataAmount = isLast
      ? roundAssetAmount(allocatedPool - allocatedSoFar)
      : roundAssetAmount(allocatedPool * (outstandingPositionDue / outstandingDue));
    const repaymentAllocated = roundAssetAmount(Math.min(proRataAmount, outstandingPositionDue));
    allocatedSoFar = roundAssetAmount(allocatedSoFar + repaymentAllocated);
    const repaymentReceived = roundAssetAmount(position.repaymentReceived + repaymentAllocated);
    const remainingDue = roundAssetAmount(Math.max(position.totalDue - repaymentReceived, 0));

    return {
      positionId: position.id,
      supplierId: position.supplierId,
      supplierOfferId: position.supplierOfferId,
      fillId: position.fillId,
      loanId: position.loanId,
      borrowerLoanRef: position.borrowerLoanRef,
      borrowAsset: position.borrowAsset,
      principalDue: position.principal,
      interestDue: position.interestDue,
      totalDue: position.totalDue,
      supplierShareBps: (position.totalDue / totalDue) * 10_000,
      repaymentAllocated,
      repaymentReceived,
      remainingDue,
      status: resolveRowStatus(repaymentReceived, position.totalDue),
    };
  });
  const totalAllocated = roundAssetAmount(allocations.reduce((sum, allocation) => sum + allocation.repaymentAllocated, 0));
  const totalReceived = roundAssetAmount(allocations.reduce((sum, allocation) => sum + allocation.repaymentReceived, 0));
  const remainingDue = roundAssetAmount(allocations.reduce((sum, allocation) => sum + allocation.remainingDue, 0));

  return {
    loanId: positions[0].loanId,
    borrowerLoanRef: positions[0].borrowerLoanRef,
    borrowAsset: positions[0].borrowAsset,
    repaymentAmount,
    totalPrincipalDue,
    totalInterestDue,
    totalDue,
    totalAllocated,
    unallocatedAmount: roundAssetAmount(Math.max(repaymentAmount - totalAllocated, 0)),
    remainingDue,
    status: resolvePreviewStatus(totalReceived, totalDue),
    allocations,
    notes: [
      "Repayment is allocated pro-rata across supplier position remaining due.",
      "Principal, interest, received, remaining due, and supplier share are explicit for each supplier.",
      "This remains a deterministic preview; watcher-backed repayment detection comes later.",
    ],
  };
}

function resolvePreviewStatus(totalReceived: number, totalDue: number): SupplierRepaymentAllocationStatus {
  if (totalDue <= 0) return "waiting_for_positions";
  if (totalReceived <= 0) return "unpaid";
  if (totalReceived >= totalDue) return "repaid";
  return "partially_repaid";
}

function resolveRowStatus(repaymentReceived: number, totalDue: number): SupplierRepaymentAllocationStatus {
  if (repaymentReceived <= 0) return "unpaid";
  if (repaymentReceived >= totalDue) return "repaid";
  return "partially_repaid";
}

function roundAssetAmount(value: number): number {
  return Number(value.toFixed(8));
}
