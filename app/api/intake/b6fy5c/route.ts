import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { loadParticipant } from "@/lib/session";

// `ai_use_frequency` and `ai_confidence` are optional because the no-AI
// (control) condition doesn't ask those questions. `essay_writing_frequency`
// is required for every condition.
const Body = z.object({
  age: z.number().int().min(16).max(100),
  gender: z.string().min(1).max(100),
  university: z.string().min(1).max(200),
  year_level: z.string().min(1).max(50),
  field_of_study: z.string().min(1).max(200),
  essay_writing_frequency: z.number().int().min(1).max(5),
  ai_use_frequency: z.number().int().min(1).max(5).optional(),
  ai_confidence: z.number().int().min(1).max(5).optional(),
});

export async function POST(req: Request) {
  const p = await loadParticipant();
  if (!p) return NextResponse.json({ error: "no session" }, { status: 401 });
  if (!p.consent_given)
    return NextResponse.json({ error: "consent required" }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const { error } = await db()
    .from("participants")
    .update({ demographics: parsed.data })
    .eq("id", p.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
