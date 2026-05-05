import { redirect } from "next/navigation";
import { after } from "next/server";
import { loadParticipant, getSessionId } from "@/lib/session";
import { biographyById } from "@/lib/prompts";
import { db } from "@/lib/db";
import TaskClient from "./TaskClient";

export const dynamic = "force-dynamic";

export default async function TaskPage() {
  // Kick off both reads concurrently. `loadParticipant` does the Supabase
  // round-trip we need for the redirect chain; the messages fetch can start
  // in parallel because it only needs `sessionId` from the cookie (cheap,
  // synchronous-ish read). If loadParticipant ends up redirecting, the
  // messages promise is just discarded — one wasted query in the rare error
  // path is well worth ~250 ms saved on every successful render.
  //
  // We use `getSessionId` (cookie-only) instead of `loadSessionId` (which
  // adds a sessions-table SELECT just to verify the row exists). The
  // messages query below scopes by session_id, so an invalid cookie just
  // returns no rows — no security gap.
  const sessionId = await getSessionId();
  const participantPromise = loadParticipant();
  const messagesPromise = sessionId
    ? db()
        .from("messages")
        .select("id, role, content, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true })
    : Promise.resolve({ data: [] as { id: number; role: string; content: string }[] });

  const p = await participantPromise;
  if (!p) redirect("/");
  if (!p.consent_given) redirect("/consent");
  if (!p.demographics) redirect("/intake");
  if (!sessionId) redirect("/");

  const bio = biographyById(p.biography_id);
  if (!bio) redirect("/");

  // First time the participant lands on /task, stamp task_started_at. The
  // submit endpoint reads this back to compute time-on-task in seconds.
  // Idempotent: subsequent visits (refresh, back-nav) won't overwrite it.
  // Wrapped in `after()` so the UPDATE doesn't sit on the rendering critical
  // path — it runs after the page HTML has been flushed to the browser.
  if (!p.task_started_at) {
    after(async () => {
      await db()
        .from("participants")
        .update({ task_started_at: new Date().toISOString() })
        .eq("id", p.id);
    });
  }

  const { data: msgs } = await messagesPromise;

  const initialMessages = (msgs ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      id: m.id as number,
      role: m.role as "user" | "assistant",
      content: m.content as string,
    }));

  const minUserTurns = Number(process.env.MIN_USER_TURNS ?? "3");
  const maxUserTurns = Number(process.env.MAX_USER_TURNS ?? "15");

  return (
    <TaskClient
      biography={bio.text}
      initialMessages={initialMessages}
      minUserTurns={minUserTurns}
      maxUserTurns={maxUserTurns}
      condition={p.condition}
    />
  );
}
