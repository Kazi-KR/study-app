import "server-only";

// "control" is the no-AI group: they see only the biography and the writing
// editor, no chat panel. Their chat-API calls are rejected server-side, and
// the submit endpoint skips the MIN_USER_TURNS check for them.
export type Condition = "biased" | "neutral" | "control";

// Slugs are intentionally opaque so participants don't infer their condition.
// Configurable via env so the researcher can rotate them between cohorts.
const SLUG_A = process.env.STUDY_SLUG_A ?? "a";
const SLUG_B = process.env.STUDY_SLUG_B ?? "b";
const SLUG_C = process.env.STUDY_SLUG_C ?? "c";

const MAP: Record<string, Condition> = {
  [SLUG_A]: "control",
  [SLUG_B]: "neutral",
  [SLUG_C]: "biased",
};

export function conditionForSlug(slug: string): Condition | null {
  return MAP[slug] ?? null;
}
