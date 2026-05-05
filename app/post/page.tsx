import { redirect } from "next/navigation";
import { loadParticipant } from "@/lib/session";
import { db } from "@/lib/db";
import PostSurvey from "./PostSurvey";

export const dynamic = "force-dynamic";

export default async function PostPage() {
  const p = await loadParticipant();
  if (!p) redirect("/");

  // The two redirect-check queries are independent (both keyed by
  // participant_id, no dependency between them), so run them concurrently
  // instead of waterfall-awaiting. Saves ~one Supabase round-trip on every
  // /post render.
  const [{ data: sub }, { data: existing }] = await Promise.all([
    db().from("submissions").select("id").eq("participant_id", p.id).maybeSingle(),
    db()
      .from("survey_responses")
      .select("id")
      .eq("participant_id", p.id)
      .eq("kind", "post")
      .maybeSingle(),
  ]);
  if (!sub) redirect("/task");
  if (existing) redirect("/end");

  return <PostSurvey condition={p.condition} />;
}
