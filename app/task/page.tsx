import { redirect } from "next/navigation";
import { loadParticipant, loadSessionId } from "@/lib/session";
import { biographyById } from "@/lib/prompts";
import { db } from "@/lib/db";
import TaskClient from "./TaskClient";

export const dynamic = "force-dynamic";

export default async function TaskPage() {
  const p = await loadParticipant();
  if (!p) redirect("/");
  if (!p.consent_given) redirect("/consent");
  if (!p.demographics) redirect("/intake");

  const sessionId = await loadSessionId();
  if (!sessionId) redirect("/");

  const bio = biographyById(p.biography_id);
  if (!bio) redirect("/");

  // First time the participant lands on /task, stamp task_started_at. The
  // submit endpoint reads this back to compute time-on-task in seconds.
  // Idempotent: subsequent visits (refresh, back-nav) won't overwrite it.
  if (!p.task_started_at) {
    await db()
      .from("participants")
      .update({ task_started_at: new Date().toISOString() })
      .eq("id", p.id);
  }

  const { data: msgs } = await db()
    .from("messages")
    .select("id, role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

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
