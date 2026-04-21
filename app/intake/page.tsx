import { redirect } from "next/navigation";
import { loadParticipant } from "@/lib/session";
import IntakeForm from "./IntakeForm";

export const dynamic = "force-dynamic";

export default async function IntakePage() {
  const p = await loadParticipant();
  if (!p) redirect("/");
  if (!p.consent_given) redirect("/consent");
  if (p.demographics) redirect("/task");
  return <IntakeForm />;
}
