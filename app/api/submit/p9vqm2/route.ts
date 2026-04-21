import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { loadParticipant, loadSessionId } from "@/lib/session";

const Body = z.object({
  final_text: z.string().min(1).max(10000),
});

const MIN_USER_TURNS = Number(process.env.MIN_USER_TURNS ?? "3");
const MIN_WORDS = 200;
const MAX_WORDS = 300;

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export async function POST(req: Request) {
  const p = await loadParticipant();
  if (!p || !p.consent_given)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sessionId = await loadSessionId();
  if (!sessionId)
    return NextResponse.json({ error: "no session" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const text = parsed.data.final_text;
  const words = wordCount(text);
  if (words < MIN_WORDS || words > MAX_WORDS) {
    return NextResponse.json(
      { error: `Career plan must be ${MIN_WORDS}–${MAX_WORDS} words (you have ${words}).` },
      { status: 400 },
    );
  }

  // Control participants have no assistant, so the chat-turn gate doesn't apply.
  if (p.condition !== "control") {
    const { count, error: cErr } = await db()
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("role", "user");

    if (cErr)
      return NextResponse.json({ error: cErr.message }, { status: 500 });

    if ((count ?? 0) < MIN_USER_TURNS) {
      return NextResponse.json(
        {
          error: `Please have at least ${MIN_USER_TURNS} exchanges with the assistant before submitting.`,
        },
        { status: 400 },
      );
    }
  }

  const { error: subErr } = await db().from("submissions").insert({
    participant_id: p.id,
    final_text: text,
    word_count: words,
  });
  if (subErr)
    return NextResponse.json({ error: subErr.message }, { status: 500 });

  await db()
    .from("sessions")
    .update({ status: "submitted", ended_at: new Date().toISOString() })
    .eq("id", sessionId);

  return NextResponse.json({ ok: true });
}
