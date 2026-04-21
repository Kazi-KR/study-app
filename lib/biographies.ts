import "server-only";
import { db } from "@/lib/db";
import { BIOGRAPHIES } from "@/lib/prompts";
import type { Condition } from "@/lib/conditions";

// Pick the biography with the fewest assignments for this condition so far.
// Ties broken by the earlier index in BIOGRAPHIES.
export async function pickBalancedBiography(
  condition: Condition,
): Promise<string> {
  const { data, error } = await db()
    .from("participants")
    .select("biography_id")
    .eq("condition", condition);

  if (error) {
    // Fail soft: if the query fails, fall back to a random pick.
    return BIOGRAPHIES[Math.floor(Math.random() * BIOGRAPHIES.length)].id;
  }

  const counts = new Map<string, number>();
  for (const b of BIOGRAPHIES) counts.set(b.id, 0);
  for (const row of data ?? []) {
    counts.set(row.biography_id, (counts.get(row.biography_id) ?? 0) + 1);
  }

  let bestId = BIOGRAPHIES[0].id;
  let bestCount = Infinity;
  for (const b of BIOGRAPHIES) {
    const c = counts.get(b.id) ?? 0;
    if (c < bestCount) {
      bestCount = c;
      bestId = b.id;
    }
  }
  return bestId;
}
