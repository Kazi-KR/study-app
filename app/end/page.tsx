import { redirect } from "next/navigation";
import { loadParticipant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DebriefPage() {
  const p = await loadParticipant();
  if (!p) redirect("/");

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold mb-4">Thank you</h1>
      <div className="space-y-4 text-sm leading-6">
        <p>
          Thank you for taking part in this study. Your responses have been
          recorded.
        </p>
        <p className="text-neutral-500 text-xs pt-4">
          You may now close this tab.
        </p>
      </div>
    </main>
  );
}
