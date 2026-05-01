import { NextResponse } from "next/server";
import { conditionForSlug } from "@/lib/conditions";
import { db } from "@/lib/db";
import { pickBalancedBiography } from "@/lib/biographies";
import { PROMPT_VERSION, biographyById } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Session cookies (no maxAge / no expires) so the cookie dies with the
// browser process. The per-tab `study_tab` marker in sessionStorage is the
// primary mechanism for "tab close = session ends"; this cookie config is
// defense in depth.
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

// Creates a brand-new participant + session for this slug, sets the auth
// cookies, and tells the client where to navigate next. Called by
// `app/study/[slug]/StudyEntry.tsx` when no `study_tab` marker is present in
// sessionStorage (i.e. fresh tab, or `/api/study/resume` returned 404).
//
// The optional `bioId` field on the body lets a researcher hand-pick which
// biography this participant sees (forwarded from `?bioId=…` on the entry
// URL). The page-level validator already rejects unknown ids with a 404, so
// by the time we get here a provided `bioId` should always be valid — but we
// re-check defensively in case the API is hit directly.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug : null;
  if (!slug) {
    return NextResponse.json({ error: "missing slug" }, { status: 400 });
  }

  const condition = conditionForSlug(slug);
  if (!condition) {
    return NextResponse.json({ error: "unknown slug" }, { status: 404 });
  }

  const requestedBioId =
    typeof body?.bioId === "string" ? body.bioId : undefined;
  if (requestedBioId !== undefined && !biographyById(requestedBioId)) {
    return NextResponse.json({ error: "unknown bioId" }, { status: 400 });
  }

  const biographyId =
    requestedBioId ?? (await pickBalancedBiography(condition));

  const { data: participant, error: pErr } = await db()
    .from("participants")
    .insert({
      condition,
      biography_id: biographyId,
      prompt_version: PROMPT_VERSION,
    })
    .select("id")
    .single();

  if (pErr || !participant) {
    return NextResponse.json(
      { error: `Failed to create participant: ${pErr?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  const { data: session, error: sErr } = await db()
    .from("sessions")
    .insert({ participant_id: participant.id })
    .select("id")
    .single();

  if (sErr || !session) {
    return NextResponse.json(
      { error: `Failed to create session: ${sErr?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  const res = NextResponse.json({
    participantId: participant.id,
    redirectTo: "/consent",
  });
  res.cookies.set("study_participant", participant.id, COOKIE_OPTS);
  res.cookies.set("study_session", session.id, COOKIE_OPTS);
  return res;
}
