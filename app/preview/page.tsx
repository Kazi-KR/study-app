import { BIOGRAPHIES } from "@/lib/prompts";
import PreviewClient from "./PreviewClient";

export const dynamic = "force-dynamic";

export default function PreviewPage() {
  const bios = BIOGRAPHIES.map((b) => ({
    id: b.id,
    pair_id: b.pair_id,
    subject_gender: b.subject_gender,
    subject_name: b.subject_name,
    text: b.text,
  }));
  return <PreviewClient biographies={bios} />;
}
