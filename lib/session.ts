import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const COOKIE_PARTICIPANT = "study_participant";
const COOKIE_SESSION = "study_session";
// Session cookies (no maxAge / no expires) so the cookie dies with the
// browser process. Per-tab session lifetime is enforced by the `study_tab`
// marker in sessionStorage (see app/study/[slug]/StudyEntry.tsx); these
// cookie options are defense in depth.
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function setStudyCookies(participantId: string, sessionId: string) {
  const c = await cookies();
  c.set(COOKIE_PARTICIPANT, participantId, COOKIE_OPTS);
  c.set(COOKIE_SESSION, sessionId, COOKIE_OPTS);
}

export async function getParticipantId(): Promise<string | null> {
  const c = await cookies();
  return c.get(COOKIE_PARTICIPANT)?.value ?? null;
}

export async function getSessionId(): Promise<string | null> {
  const c = await cookies();
  return c.get(COOKIE_SESSION)?.value ?? null;
}

export type ParticipantRow = {
  id: string;
  condition: "biased" | "neutral" | "control";
  biography_id: string;
  consent_given: boolean;
  demographics: Record<string, unknown> | null;
  debriefed: boolean;
};

export async function loadParticipant(): Promise<ParticipantRow | null> {
  const id = await getParticipantId();
  if (!id) return null;
  const { data, error } = await db()
    .from("participants")
    .select("id, condition, biography_id, consent_given, demographics, debriefed")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as ParticipantRow;
}

export async function loadSessionId(): Promise<string | null> {
  const sid = await getSessionId();
  if (!sid) return null;
  const { data } = await db()
    .from("sessions")
    .select("id")
    .eq("id", sid)
    .maybeSingle();
  return data?.id ?? null;
}
