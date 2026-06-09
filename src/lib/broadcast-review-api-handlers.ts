import { createAndStoreBroadcastReview, listBroadcastReviews } from "./broadcast-review-store";
import type { BroadcastReviewGate } from "./broadcast-review";
import type { ApiHandlerResponse } from "./signing-session-api-handlers";

interface CreateBroadcastReviewRequest {
  sessionId?: unknown;
}

export function handleListBroadcastReviews(): ApiHandlerResponse<{ reviews: BroadcastReviewGate[] }> {
  return { status: 200, body: { reviews: listBroadcastReviews() } };
}

export function handleCreateBroadcastReview(input: unknown): ApiHandlerResponse<Record<string, unknown>> {
  const sessionId = (input as CreateBroadcastReviewRequest | null)?.sessionId;

  if (typeof sessionId !== "string" || !sessionId.trim()) {
    return { status: 400, body: { error: "sessionId is required." } };
  }

  const review = createAndStoreBroadcastReview(sessionId);

  if (!review) {
    return { status: 404, body: { error: "Signing session not found." } };
  }

  return {
    status: review.status === "blocked" ? 400 : 200,
    body: {
      review,
      canBroadcast: false,
    },
  };
}
