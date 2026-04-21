import { redirect } from "next/navigation";
import { loadParticipant } from "@/lib/session";
import { db } from "@/lib/db";
import PostSurvey from "./PostSurvey";

export const dynamic = "force-dynamic";

export default async function PostPage() {
  const p = await loadParticipant();
  if (!p) redirect("/");
  const { data: sub } = await db()
    .from("submissions")
    .select("id")
    .eq("participant_id", p.id)
    .maybeSingle();
  if (!sub) redirect("/task");

  const { data: existing } = await db()
    .from("survey_responses")
    .select("id")
    .eq("participant_id", p.id)
    .eq("kind", "post")
    .maybeSingle();
  if (existing) redirect("/end");

  return <PostSurvey condition={p.condition} />;
}
