"use client";

import { ClipboardList, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BroadcastReviewGate } from "@/lib/broadcast-review";
import type { SigningRole, SigningSession } from "@/lib/signing-collection";
import type { TransactionReviewEnvelope } from "@/lib/transaction-review";

type SubmissionForm = Record<SigningRole, string>;

interface SigningSessionListResponse {
  sessions: SigningSession[];
}

interface SigningSessionCreateResponse {
  session: SigningSession;
  canSubmitSignatures: boolean;
  error?: string;
}

interface SigningSubmissionResponse {
  session?: SigningSession;
  accepted?: boolean;
  blockers?: string[];
  error?: string;
}

interface BroadcastReviewListResponse {
  reviews: BroadcastReviewGate[];
  error?: string;
}

interface BroadcastReviewCreateResponse {
  review?: BroadcastReviewGate;
  canBroadcast?: false;
  error?: string;
}

const sampleReadyReview: TransactionReviewEnvelope = {
  id: "txreview_simnet_sample_collateral_release",
  loanId: "loan_sample_external_signing",
  loanRef: "DCA-SAMPLE-001",
  purpose: "collateral_release",
  purposeLabel: "Collateral release review",
  network: "simnet",
  status: "ready_for_signing",
  summary: "Sample simnet-ready review for exercising external signature collection without signing or broadcasting.",
  adapterReview: {
    id: "txreview_simnet_sample_collateral_release",
    loanId: "loan_sample_external_signing",
    purpose: "collateral_release",
    status: "ready_for_signing",
    network: "simnet",
    summary: "Sample simnet-ready review for exercising external signature collection without signing or broadcasting.",
    unsignedTransaction: {
      id: "unsigned_sample_collateral_release",
      network: "simnet",
      purpose: "collateral_release",
      loanId: "loan_sample_external_signing",
      fromAddress: "SsampleEscrowAddress",
      toAddress: "SsampleBorrowerRefundAddress",
      amountDcr: 10,
      estimatedFeeDcr: 0.001,
      requiredSignatures: 2,
      totalSigners: 3,
      rawTransactionHex: "01000000sample_unsigned_external_signing_review",
      warnings: ["Sample unsigned transaction hex for UI flow testing only."],
    },
    requiredApprovals: ["Borrower", "Lender", "Operator"],
    blockers: [],
    createdAt: "2026-06-08T00:00:00.000Z",
  },
  unsignedTransaction: {
    id: "unsigned_sample_collateral_release",
    network: "simnet",
    purpose: "collateral_release",
    loanId: "loan_sample_external_signing",
    fromAddress: "SsampleEscrowAddress",
    toAddress: "SsampleBorrowerRefundAddress",
    amountDcr: 10,
    estimatedFeeDcr: 0.001,
    requiredSignatures: 2,
    totalSigners: 3,
    rawTransactionHex: "01000000sample_unsigned_external_signing_review",
    warnings: ["Sample unsigned transaction hex for UI flow testing only."],
  },
  approvals: {
    borrower: true,
    lender: true,
    arbiter: false,
    operator: true,
  },
  requiredApprovals: ["borrower", "lender", "operator"],
  blockers: [],
  warnings: [
    "Sample review is for UI flow testing only.",
    "Broadcast remains disabled and separate from signature collection.",
  ],
  signingBoundary: {
    canSign: false,
    canBroadcast: false,
    storesPrivateKeys: false,
    rawTransactionHexPresent: true,
    privateKeyHandling: "none",
    broadcastHandling: "disabled",
  },
  createdAt: "2026-06-08T00:00:00.000Z",
};

export function SigningSessionPanel({ review }: { review: TransactionReviewEnvelope | null }) {
  const [sessions, setSessions] = useState<SigningSession[]>([]);
  const [broadcastReviews, setBroadcastReviews] = useState<BroadcastReviewGate[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [submissionHex, setSubmissionHex] = useState<SubmissionForm>({ borrower: "", lender: "", arbiter: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeReview = useMemo(() => review ?? sampleReadyReview, [review]);
  const isUsingSampleReview = !review;
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? sessions[0] ?? null;
  const selectedBroadcastReview = selectedSession
    ? broadcastReviews.find((broadcastReview) => broadcastReview.sessionId === selectedSession.id) ?? null
    : null;

  const loadBroadcastReviews = useCallback(async () => {
    const response = await fetch("/api/broadcast-reviews", { cache: "no-store" });
    const result = (await response.json()) as BroadcastReviewListResponse;
    if (!response.ok) throw new Error(result.error ?? "Broadcast reviews could not load.");
    setBroadcastReviews(result.reviews);
  }, []);

  const loadSessions = useCallback(async () => {
    setBusy("load");
    setNotice(null);
    try {
      const response = await fetch("/api/signing-sessions", { cache: "no-store" });
      const result = (await response.json()) as SigningSessionListResponse & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Signing sessions could not load.");
      setSessions(result.sessions);
      setSelectedSessionId((current) => current || result.sessions[0]?.id || "");
      await loadBroadcastReviews();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Signing sessions could not load.");
    } finally {
      setBusy(null);
    }
  }, [loadBroadcastReviews]);

  async function createSession() {
    setBusy("create");
    setNotice(null);
    try {
      const response = await fetch("/api/signing-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review: activeReview }),
      });
      const result = (await response.json()) as SigningSessionCreateResponse;
      if (!response.ok) throw new Error(result.error ?? "Signing session could not be created.");
      setSessions((current) => [result.session, ...current.filter((session) => session.id !== result.session.id)]);
      setSelectedSessionId(result.session.id);
      setNotice(result.canSubmitSignatures ? "Signing session is collecting external signatures." : "Signing session is blocked.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Signing session could not be created.");
    } finally {
      setBusy(null);
    }
  }

  async function submitExternalSignature(role: SigningRole) {
    if (!selectedSession) return;
    setBusy(role);
    setNotice(null);
    try {
      const response = await fetch("/api/signing-sessions/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: selectedSession.id,
          role,
          signedTransactionHex: submissionHex[role],
        }),
      });
      const result = (await response.json()) as SigningSubmissionResponse;
      if (!response.ok) throw new Error(result.error ?? result.blockers?.join(" ") ?? "Signature submission was rejected.");
      if (!result.session) throw new Error("Updated signing session was not returned.");
      setSessions((current) => current.map((session) => (session.id === result.session?.id ? result.session : session)));
      setSubmissionHex((current) => ({ ...current, [role]: "" }));
      setNotice(result.session.status === "ready_for_broadcast_review" ? "Required external signatures are collected." : `${role} signature recorded.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Signature submission failed.");
    } finally {
      setBusy(null);
    }
  }

  async function createBroadcastReviewForSelectedSession() {
    if (!selectedSession) return;
    setBusy("broadcast-review");
    setNotice(null);
    try {
      const response = await fetch("/api/broadcast-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: selectedSession.id }),
      });
      const result = (await response.json()) as BroadcastReviewCreateResponse;
      if (!result.review) throw new Error(result.error ?? "Broadcast review was not returned.");
      setBroadcastReviews((current) => [result.review as BroadcastReviewGate, ...current.filter((item) => item.id !== result.review?.id)]);
      if (!response.ok) {
        setNotice(result.review.blockers.join(" ") || result.error || "Broadcast review is blocked.");
        return;
      }
      setNotice("Broadcast review created for manual operator review. Broadcasting remains disabled.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Broadcast review could not be created.");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    // This effect starts one async session load after the panel mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSessions();
  }, [loadSessions]);

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-lg border border-[#d8dfda] bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Signing sessions</h2>
            <p className="mt-2 text-sm text-[#577067]">
              Collect externally signed transaction hex. This screen does not sign, unlock wallets, broadcast, or store keys.
            </p>
          </div>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[#ccd6d0] bg-white px-3 text-sm font-medium text-[#17211d] hover:bg-[#eef3f0]"
            onClick={loadSessions}
            disabled={busy === "load"}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {isUsingSampleReview ? (
            <div className="rounded-md bg-[#fff4d8] p-3 text-sm text-[#6f4d00]">
              No live transaction review is attached to this standalone page, so it uses a sample simnet-ready review for UI flow testing.
            </div>
          ) : null}
          <button
            className="inline-flex h-11 items-center gap-2 rounded-md bg-[#17211d] px-4 text-sm font-semibold text-white hover:bg-[#2b3732] disabled:opacity-60"
            disabled={busy === "create"}
            onClick={createSession}
          >
            <ClipboardList className="h-4 w-4" />
            {isUsingSampleReview ? "Create sample signing session" : "Create from current review"}
          </button>
          {notice ? <p className="rounded-md bg-[#eef3f0] p-3 text-sm text-[#42524c]">{notice}</p> : null}
        </div>

        <div className="mt-5 space-y-2">
          {sessions.length ? sessions.map((session) => (
            <button
              key={session.id}
              className={`w-full rounded-md border p-3 text-left ${selectedSession?.id === session.id ? "border-[#155e59] bg-[#e3f4ef]" : "border-[#d8dfda] bg-[#f7f9f8]"}`}
              onClick={() => setSelectedSessionId(session.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[#17211d]">{session.loanId}</span>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#42524c]">{session.status.replaceAll("_", " ")}</span>
              </div>
              <p className="mt-2 text-sm text-[#577067]">{session.purpose.replaceAll("_", " ")} · {session.network}</p>
            </button>
          )) : (
            <div className="rounded-md border border-dashed border-[#c4d0c8] bg-[#f7f9f8] p-5 text-sm text-[#6b7b74]">
              No signing sessions yet.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-[#d8dfda] bg-white p-5">
        {selectedSession ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold">External signature collection</h2>
              <p className="mt-2 text-sm text-[#577067]">Required roles: {selectedSession.requiredRoles.join(", ")}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <MiniReadout label="Status" value={selectedSession.status.replaceAll("_", " ")} />
              <MiniReadout label="Submissions" value={`${selectedSession.submissions.length}/${selectedSession.requiredRoles.length}`} />
              <MiniReadout label="Broadcast review" value={selectedBroadcastReview?.status.replaceAll("_", " ") ?? (selectedSession.status === "ready_for_broadcast_review" ? "ready" : "not ready")} />
            </div>

            {selectedSession.blockers.length ? (
              <div className="space-y-2">
                {selectedSession.blockers.map((blocker) => (
                  <div key={blocker} className="rounded-md bg-[#fff4d8] p-3 text-sm text-[#6f4d00]">{blocker}</div>
                ))}
              </div>
            ) : null}

            <div className="rounded-md border border-[#d8dfda] bg-[#f7f9f8] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-[#17211d]">Broadcast review gate</p>
                  <p className="mt-1 text-sm text-[#577067]">
                    Creates a review decision only. It verifies fixture signatures and keeps broadcasting disabled.
                  </p>
                </div>
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-[#17211d] px-3 text-sm font-semibold text-white hover:bg-[#2b3732] disabled:opacity-60"
                  disabled={selectedSession.status !== "ready_for_broadcast_review" || busy === "broadcast-review"}
                  onClick={createBroadcastReviewForSelectedSession}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Create broadcast review
                </button>
              </div>

              {selectedBroadcastReview ? (
                <div className="mt-4 space-y-3 rounded-md bg-white p-3 text-sm text-[#42524c]">
                  <div className="grid gap-3 md:grid-cols-3">
                    <MiniReadout label="Review status" value={selectedBroadcastReview.status.replaceAll("_", " ")} />
                    <MiniReadout label="Can broadcast" value="no" />
                    <MiniReadout label="Operator approval" value={selectedBroadcastReview.requiresOperatorApproval ? "required" : "not required"} />
                  </div>
                  {selectedBroadcastReview.blockers.length ? (
                    <ReviewList title="Blockers" items={selectedBroadcastReview.blockers} tone="warning" />
                  ) : null}
                  {selectedBroadcastReview.warnings.length ? (
                    <ReviewList title="Warnings" items={selectedBroadcastReview.warnings} tone="neutral" />
                  ) : null}
                  {selectedBroadcastReview.signatureResults.length ? (
                    <div>
                      <p className="font-semibold text-[#17211d]">Fixture signature results</p>
                      <div className="mt-2 space-y-2">
                        {selectedBroadcastReview.signatureResults.map((result) => (
                          <div key={result.role} className="rounded-md border border-[#d8dfda] p-3">
                            <p className="font-semibold capitalize">{result.role}: {result.ok ? "accepted" : "blocked"}</p>
                            {result.blockers.length ? <ReviewList title="Result blockers" items={result.blockers} tone="warning" /> : null}
                            {result.warnings.length ? <ReviewList title="Result warnings" items={result.warnings} tone="neutral" /> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              {selectedSession.requiredRoles.map((role) => {
                const submitted = selectedSession.submissions.some((submission) => submission.role === role);
                return (
                  <div key={role} className="rounded-md border border-[#d8dfda] bg-[#f7f9f8] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold capitalize">{role}</p>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#42524c]">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {submitted ? "submitted" : "missing"}
                      </span>
                    </div>
                    <textarea
                      className="mt-3 min-h-24 w-full rounded-md border border-[#ccd6d0] bg-white p-3 font-mono text-xs"
                      placeholder="Paste externally signed transaction hex. Do not paste private keys, seeds, or passphrases."
                      value={submissionHex[role]}
                      onChange={(event) => setSubmissionHex((current) => ({ ...current, [role]: event.target.value }))}
                    />
                    <button
                      className="mt-3 inline-flex h-10 items-center gap-2 rounded-md bg-[#155e59] px-3 text-sm font-semibold text-white hover:bg-[#104d49] disabled:opacity-60"
                      disabled={!submissionHex[role] || busy === role}
                      onClick={() => submitExternalSignature(role)}
                    >
                      <Upload className="h-4 w-4" />
                      Submit external signature
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid min-h-56 place-items-center rounded-md border border-dashed border-[#c4d0c8] bg-[#f7f9f8] p-8 text-center">
            <div>
              <ClipboardList className="mx-auto h-8 w-8 text-[#6b7b74]" />
              <p className="mt-3 font-semibold">No signing session selected</p>
              <p className="mt-1 text-sm text-[#6b7b74]">Create a session from a ready transaction review.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function MiniReadout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[#eef3f0] p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#577067]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[#17211d]">{value}</p>
    </div>
  );
}

function ReviewList({ title, items, tone }: { title: string; items: string[]; tone: "neutral" | "warning" }) {
  const className = tone === "warning" ? "bg-[#fff4d8] text-[#6f4d00]" : "bg-[#eef3f0] text-[#42524c]";

  return (
    <div>
      <p className="font-semibold text-[#17211d]">{title}</p>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <div key={item} className={`rounded-md p-3 ${className}`}>{item}</div>
        ))}
      </div>
    </div>
  );
}
