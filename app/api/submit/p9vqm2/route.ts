import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { loadParticipant, loadSessionId } from "@/lib/session";

const Body = z.object({
  final_text: z.string().min(1).max(10000),
});

const MIN_USER_TURNS = Number(process.env.MIN_USER_TURNS ?? "3");
const MIN_WORDS = 200;

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
  if (words < MIN_WORDS) {
    return NextResponse.json(
      { error: `Career plan must be at least ${MIN_WORDS} words (you have ${words}).` },
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

  // Compute time-on-task in seconds. `task_started_at` is stamped server-side
  // when the participant first lands on /task (see app/task/page.tsx). If for
  // any reason it's missing (e.g. a participant whose row predates the
  // task_started_at column) we leave duration_seconds null rather than
  // recording a misleading zero.
  const taskStartedAt = p.task_started_at;
  const durationSeconds = taskStartedAt
    ? Math.max(
        0,
        Math.round(
          (Date.now() - new Date(taskStartedAt).getTime()) / 1000,
        ),
      )
    : null;

  const { error: subErr } = await db().from("submissions").insert({
    participant_id: p.id,
    final_text: text,
    word_count: words,
    duration_seconds: durationSeconds,
  });
  if (subErr)
    return NextResponse.json({ error: subErr.message }, { status: 500 });

  await db()
    .from("sessions")
    .update({ status: "submitted", ended_at: new Date().toISOString() })
    .eq("id", sessionId);

  return NextResponse.json({ ok: true });
}
