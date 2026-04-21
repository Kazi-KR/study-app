import { redirect } from "next/navigation";
import { loadParticipant } from "@/lib/session";
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
    const pp = await loadParticipant();
    if (!pp) return;
    await db().from("participants").update({ consent_given: true }).eq("id", pp.id);
    redirect("/intake");
  }

  return <ConsentForm action={onConsent} />;
}
