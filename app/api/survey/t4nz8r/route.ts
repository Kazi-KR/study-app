import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { loadParticipant } from "@/lib/session";

const Body = z.object({
  kind: z.enum(["pre", "post"]),
  likert: z.record(z.string(), z.number().int().min(1).max(7)).optional(),
  // AI usage behavior
  usage_pattern: z.enum(["a", "b", "c", "d", "other"]).optional(),
  usage_pattern_other: z.string().max(2000).optional(),
  // Bias awareness check
  noticed_anything: z.string().max(4000).optional(),
  study_guess: z.string().max(4000).optional(),
  // Kept for backwards compatibility with any pre-v4 survey payloads that
  // may still be in flight during deploy; safe to drop once fully rolled out.
  open_feedback: z.string().max(4000).optional(),
});

export async function POST(req: Request) {
  const p = await loadParticipant();
  if (!p)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const { error } = await db().from("survey_responses").insert({
    participant_id: p.id,
    kind: parsed.data.kind,
    payload: parsed.data,
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
