import { createBroadcastReview, type BroadcastReviewGate } from "./broadcast-review";
import { getSigningSession } from "./signing-session-store";

const reviews = new Map<string, BroadcastReviewGate>();

export function createAndStoreBroadcastReview(sessionId: string): BroadcastReviewGate | null {
  const session = getSigningSession(sessionId);
  if (!session) return null;

  const review = createBroadcastReview({ session });
  reviews.set(review.id, review);
  return review;
}

export function getBroadcastReview(reviewId: string): BroadcastReviewGate | null {
  return reviews.get(reviewId) ?? null;
}

export function listBroadcastReviews(): BroadcastReviewGate[] {
  return [...reviews.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listBroadcastReviewsForSession(sessionId: string): BroadcastReviewGate[] {
  return listBroadcastReviews().filter((review) => review.sessionId === sessionId);
}

export function resetBroadcastReviewsForTests(): void {
  reviews.clear();
}
