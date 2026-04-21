import { NextResponse } from "next/server";
import { conditionForSlug } from "@/lib/conditions";
import { db } from "@/lib/db";
import { pickBalancedBiography } from "@/lib/biographies";
import { PROMPT_VERSION } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const condition = conditionForSlug(slug);
  if (!condition) {
    return new NextResponse("Not found", { status: 404 });
  }

  const biographyId = await pickBalancedBiography(condition);

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
    return new NextResponse(
      `Failed to create participant: ${pErr?.message ?? "unknown"}`,
      { status: 500 },
    );
  }

  const { data: session, error: sErr } = await db()
    .from("sessions")
    .insert({ participant_id: participant.id })
    .select("id")
    .single();

  if (sErr || !session) {
    return new NextResponse(
      `Failed to create session: ${sErr?.message ?? "unknown"}`,
      { status: 500 },
    );
  }

  const res = NextResponse.redirect(new URL("/consent", req.url));
  res.cookies.set("study_participant", participant.id, COOKIE_OPTS);
  res.cookies.set("study_session", session.id, COOKIE_OPTS);
  return res;
}
