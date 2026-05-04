import { redirect } from "next/navigation";
import { getParticipantId, loadParticipant } from "@/lib/session";
import { db } from "@/lib/db";
import ConsentForm from "./ConsentForm";

export const dynamic = "force-dynamic";

export default async function ConsentPage() {
  const p = await loadParticipant();
  if (!p) redirect("/");
  if (p.consent_given) redirect("/intake");

  async function onConsent(formData: FormData) {
    "use server";
    const agreed = formData.get("consent") === "on";
    if (!agreed) return;
    // Read the participant id straight from the cookie instead of doing a
    // full `loadParticipant()` SELECT — we only need the id to scope the
    // UPDATE, and the round-trip to fetch the row again is pure overhead on
    // the click→navigate path. Saves ~200–500ms of perceived latency.
    const id = await getParticipantId();
    if (!id) return;
    await db().from("participants").update({ consent_given: true }).eq("id", id);
    redirect("/intake");
  }

  return <ConsentForm action={onConsent} />;
}
