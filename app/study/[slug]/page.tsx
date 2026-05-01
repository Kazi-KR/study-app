import { notFound } from "next/navigation";
import { conditionForSlug } from "@/lib/conditions";
import { biographyById } from "@/lib/prompts";
import StudyEntry from "./StudyEntry";

export const dynamic = "force-dynamic";

// Entry page for participants. The page itself does no DB writes — it only
// validates the slug and (optionally) the `bioId` query parameter. The actual
// handshake (resume vs. start) happens in the client component, which inspects
// sessionStorage so we get per-tab session lifetime: closing the tab clears
// the marker, so reopening the link in a new tab starts a brand-new
// participant.
//
// `?bioId=<id>` lets a researcher hand-pick which biography this participant
// sees, bypassing the balanced rotation. If the id is unknown we 404 here so
// typos fail loudly during link distribution rather than silently picking
// something else. Omit the param to fall back to balanced selection.
export default async function StudyEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  if (!conditionForSlug(slug)) {
    notFound();
  }

  const sp = await searchParams;
  const rawBioId = sp.bioId;
  const bioId = typeof rawBioId === "string" ? rawBioId : undefined;
  if (bioId !== undefined && !biographyById(bioId)) {
    notFound();
  }

  return <StudyEntry slug={slug} bioId={bioId} />;
}
