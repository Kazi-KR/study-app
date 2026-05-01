import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { loadParticipant } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reads the existing participant cookie and returns the path the participant
// should be on, based on what they've completed so far. Called by
// `app/study/[slug]/StudyEntry.tsx` when a `study_tab` marker is present in
// sessionStorage (i.e. refresh inside the same tab). Returns 404 if the
// cookie is missing or stale; the client falls through to `/api/study/start`
// in that case.
export async function POST() {
  const p = await loadParticipant();
  if (!p) {
    return NextResponse.json({ error: "no participant" }, { status: 404 });
  }

  let redirectTo: string;
  if (!p.consent_given) {
    redirectTo = "/consent";
  } else if (!p.demographics) {
    redirectTo = "/intake";
  } else {
    const { data: sub } = await db()
      .from("submissions")
      .select("id")
      .eq("participant_id", p.id)
      .maybeSingle();
    if (!sub) {
      redirectTo = "/task";
    } else {
      const { data: postSurvey } = await db()
        .from("survey_responses")
        .select("id")
        .eq("participant_id", p.id)
        .eq("kind", "post")
        .maybeSingle();
      redirectTo = postSurvey ? "/end" : "/post";
    }
  }

  return NextResponse.json({ participantId: p.id, redirectTo });
}
