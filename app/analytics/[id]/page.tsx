import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { biographyById } from "@/lib/prompts";
import { isAdmin } from "../auth";
import TokenGate from "../TokenGate";

export const dynamic = "force-dynamic";

// Per-participant detail page. Shows everything we have on a single
// participant: assignment metadata, intake demographics, the submitted career
// plan, and the post-survey payload. Same auth gate as the index.
export default async function ParticipantDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;

  const ok = await isAdmin();
  if (!ok) {
    const sp = await searchParams;
    return (
      <TokenGate
        redirectTo={`/analytics/${id}`}
        error={sp.error === "1"}
      />
    );
  }

  // UUID sanity check — saves a Supabase round-trip on garbage URLs.
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id,
    )
  ) {
    notFound();
  }

  const { data: p, error: pErr } = await db()
    .from("participants")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (pErr) return <Err msg={`participants: ${pErr.message}`} />;
  if (!p) notFound();

  const [subRes, postRes] = await Promise.all([
    db()
      .from("submissions")
      .select("*")
      .eq("participant_id", id)
      .order("submitted_at", { ascending: false }),
    db()
      .from("survey_responses")
      .select("*")
      .eq("participant_id", id)
      .eq("kind", "post")
      .order("created_at", { ascending: false }),
  ]);

  if (subRes.error) return <Err msg={`submissions: ${subRes.error.message}`} />;
  if (postRes.error)
    return <Err msg={`survey_responses: ${postRes.error.message}`} />;

  const submission = subRes.data?.[0] ?? null;
  const post = postRes.data?.[0] ?? null;
  const demographics = (p.demographics ?? {}) as Record<string, unknown>;
  const postPayload = (post?.payload ?? {}) as Record<string, unknown>;
  const bio = biographyById(p.biography_id);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <Link
          href="/analytics"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← Back to analytics
        </Link>
      </div>

      <h1 className="text-2xl font-semibold mb-1">Participant detail</h1>
      <p className="font-mono text-xs text-neutral-500 mb-8 dark:text-neutral-400">
        {p.id}
      </p>

      <Section title="Assignment">
        <KV k="Created at" v={p.created_at} />
        <KV k="Condition" v={p.condition} />
        <KV
          k="Biography"
          v={`${p.biography_id} — ${bio?.subject_name ?? "(unknown)"} (${bio?.subject_gender ?? "—"})`}
        />
        <KV k="Prompt version" v={p.prompt_version} />
        <KV k="Consent given" v={String(p.consent_given)} />
        <KV k="Task started at" v={p.task_started_at ?? "(not started)"} />
        <KV k="Debriefed" v={String(p.debriefed)} />
      </Section>

      <Section title="Pre-survey (intake demographics)">
        {Object.keys(demographics).length === 0 ? (
          <p className="text-sm text-neutral-500">(empty)</p>
        ) : (
          <KvJson obj={demographics} />
        )}
      </Section>

      <Section title="Writing submission">
        {!submission ? (
          <p className="text-sm text-neutral-500">(no submission yet)</p>
        ) : (
          <>
            <KV k="Submitted at" v={submission.submitted_at} />
            <KV k="Word count" v={submission.word_count} />
            <KV
              k="Duration (sec)"
              v={
                submission.duration_seconds === null
                  ? "(not recorded)"
                  : submission.duration_seconds
              }
            />
            <div className="mt-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1 dark:text-neutral-400">
                Career plan
              </div>
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 whitespace-pre-wrap dark:border-neutral-800 dark:bg-neutral-950">
                {submission.final_text}
              </div>
            </div>
          </>
        )}
      </Section>

      <Section title="Post-survey">
        {!post ? (
          <p className="text-sm text-neutral-500">(no post-survey yet)</p>
        ) : (
          <>
            <KV k="Recorded at" v={post.created_at} />
            <KvJson obj={postPayload} />
          </>
        )}
      </Section>

      {bio && (
        <Section title="Biography (reference)">
          <p className="text-sm leading-6 whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
            {bio.text}
          </p>
        </Section>
      )}
    </main>
  );
}

// --- Sub-components --------------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-3 dark:text-neutral-400">
        {title}
      </h2>
      <div className="space-y-1 text-sm">{children}</div>
    </section>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="text-neutral-500 dark:text-neutral-400">{k}</div>
      <div className="col-span-2 break-words">{v}</div>
    </div>
  );
}

// Renders a flat object as a key/value list. Nested objects/arrays get
// pretty-printed JSON inside a code block — handy for things like the Likert
// answers map inside the post-survey payload.
function KvJson({ obj }: { obj: Record<string, unknown> }) {
  return (
    <>
      {Object.entries(obj).map(([k, v]) => {
        const isObj = v !== null && typeof v === "object";
        return (
          <div key={k} className="grid grid-cols-3 gap-4">
            <div className="text-neutral-500 dark:text-neutral-400">{k}</div>
            <div className="col-span-2 break-words">
              {isObj ? (
                <pre className="rounded bg-neutral-50 p-2 text-xs whitespace-pre-wrap dark:bg-neutral-950">
                  {JSON.stringify(v, null, 2)}
                </pre>
              ) : v === null || v === undefined || v === "" ? (
                <span className="text-neutral-400">(empty)</span>
              ) : (
                String(v)
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

function Err({ msg }: { msg: string }) {
  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="text-lg font-semibold mb-2">Analytics — error</h1>
      <p className="text-sm text-red-600 dark:text-red-400">{msg}</p>
    </main>
  );
}
