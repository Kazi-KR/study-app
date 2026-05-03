import Link from "next/link";
import { db } from "@/lib/db";
import { isAdmin, clearAdminCookie } from "./auth";
import TokenGate from "./TokenGate";

export const dynamic = "force-dynamic";

// Researcher dashboard. Shows aggregate counts + a flat table of every
// participant who has finished the post-task survey (i.e. completed the full
// study end-to-end). Click any row to see that participant's full assignment,
// demographics, written submission, and post-survey answers.
//
// Auth: gated on the EXPORT_TOKEN. The token is pasted via TokenGate.tsx and
// stored in a session cookie (see ./auth.ts).
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const ok = await isAdmin();
  if (!ok) {
    const sp = await searchParams;
    return (
      <TokenGate redirectTo="/analytics" error={sp.error === "1"} />
    );
  }

  // Sign-out action. Reads no input; just clears the cookie and redirects
  // back so TokenGate appears again.
  async function signOut() {
    "use server";
    await clearAdminCookie();
  }

  // 1. Find every participant_id that has a post-survey row. These are the
  //    "completed" participants — they finished the entire flow.
  const { data: postRows, error: psErr } = await db()
    .from("survey_responses")
    .select("participant_id, payload, created_at")
    .eq("kind", "post")
    .order("created_at", { ascending: false });

  if (psErr) {
    return <ErrorPage message={`survey_responses: ${psErr.message}`} />;
  }
  const completedIds = (postRows ?? []).map((r) => r.participant_id as string);

  // 2. Fetch their participant rows and submissions in parallel.
  const [partsRes, subsRes] = await Promise.all([
    completedIds.length > 0
      ? db().from("participants").select("*").in("id", completedIds)
      : Promise.resolve({ data: [] as ParticipantRow[], error: null }),
    completedIds.length > 0
      ? db()
          .from("submissions")
          .select("*")
          .in("participant_id", completedIds)
      : Promise.resolve({ data: [] as SubmissionRow[], error: null }),
  ]);

  if (partsRes.error)
    return <ErrorPage message={`participants: ${partsRes.error.message}`} />;
  if (subsRes.error)
    return <ErrorPage message={`submissions: ${subsRes.error.message}`} />;

  const participants = (partsRes.data ?? []) as ParticipantRow[];
  const submissions = (subsRes.data ?? []) as SubmissionRow[];

  // Index helpers for the join.
  const subByParticipant = new Map<string, SubmissionRow>();
  for (const s of submissions) subByParticipant.set(s.participant_id, s);

  const postByParticipant = new Map<
    string,
    { payload: PostPayload; created_at: string }
  >();
  for (const r of postRows ?? []) {
    if (!postByParticipant.has(r.participant_id as string)) {
      postByParticipant.set(r.participant_id as string, {
        payload: (r.payload ?? {}) as PostPayload,
        created_at: r.created_at as string,
      });
    }
  }

  // Order rows by post-survey completion time (newest first), since
  // `participants.created_at` only marks when they entered the study, not
  // when they finished.
  const rows = [...participants].sort((a, b) => {
    const ta = postByParticipant.get(a.id)?.created_at ?? a.created_at;
    const tb = postByParticipant.get(b.id)?.created_at ?? b.created_at;
    return tb.localeCompare(ta);
  });

  // 3. Aggregate counts. Gender comes from `demographics.gender`. The intake
  //    form lets participants self-describe, so we bucket by exact match for
  //    Male/Female and lump everything else into "Other / not specified".
  const total = rows.length;
  let male = 0;
  let female = 0;
  let other = 0;
  for (const p of rows) {
    const g = (p.demographics as Record<string, unknown> | null)?.gender;
    if (g === "Male") male += 1;
    else if (g === "Female") female += 1;
    else other += 1;
  }

  const conditionCounts: Record<string, number> = {
    biased: 0,
    neutral: 0,
    control: 0,
  };
  for (const p of rows) conditionCounts[p.condition] += 1;

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <form action={signOut}>
          <button
            type="submit"
            className="text-xs text-neutral-500 underline hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            Sign out
          </button>
        </form>
      </div>

      <p className="text-sm text-neutral-600 mb-4 dark:text-neutral-400">
        Showing {total} participant{total === 1 ? "" : "s"} who completed the
        full study (i.e. submitted the post-task survey). In-progress
        participants are excluded.
      </p>

      {/* Aggregate counts */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <Stat label="Total completed" value={total} emphasis />
        <Stat label="Male" value={male} />
        <Stat label="Female" value={female} />
        <Stat label="Other / unspecified" value={other} />
        <Stat label="Biased" value={conditionCounts.biased} />
        <Stat label="Neutral + Control" value={conditionCounts.neutral + conditionCounts.control} sub={`${conditionCounts.neutral} / ${conditionCounts.control}`} />
      </div>

      {/* Table */}
      {total === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
          No completed participants yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">
              <tr>
                <Th>Participant</Th>
                <Th>Completed at</Th>
                <Th>Condition</Th>
                <Th>Bio</Th>
                <Th>Age</Th>
                <Th>Gender</Th>
                <Th>University</Th>
                <Th>Year</Th>
                <Th>Field</Th>
                <Th align="right">Words</Th>
                <Th align="right">Time (s)</Th>
                <Th>Job suggestion</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const sub = subByParticipant.get(p.id);
                const post = postByParticipant.get(p.id);
                const demo = (p.demographics ?? {}) as Record<string, unknown>;
                const job = (post?.payload?.job_suggestion ?? "") as string;
                return (
                  <tr
                    key={p.id}
                    className="border-t border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50"
                  >
                    <Td>
                      <Link
                        href={`/analytics/${p.id}`}
                        className="font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {p.id.slice(0, 8)}…
                      </Link>
                    </Td>
                    <Td>{fmtDate(post?.created_at ?? p.created_at)}</Td>
                    <Td>{p.condition}</Td>
                    <Td className="font-mono text-xs">{p.biography_id}</Td>
                    <Td>{toS(demo.age)}</Td>
                    <Td>{toS(demo.gender)}</Td>
                    <Td>{toS(demo.university)}</Td>
                    <Td>{toS(demo.year_level)}</Td>
                    <Td>{toS(demo.field_of_study)}</Td>
                    <Td align="right">{sub?.word_count ?? "—"}</Td>
                    <Td align="right">{sub?.duration_seconds ?? "—"}</Td>
                    <Td className="max-w-[240px] truncate" title={job}>
                      {job || "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

// --- Helpers / sub-components ---------------------------------------------

type ParticipantRow = {
  id: string;
  created_at: string;
  condition: "biased" | "neutral" | "control";
  biography_id: string;
  prompt_version: string;
  consent_given: boolean;
  demographics: unknown;
  debriefed: boolean;
  task_started_at: string | null;
};

type SubmissionRow = {
  id: string;
  participant_id: string;
  final_text: string;
  word_count: number;
  duration_seconds: number | null;
  submitted_at: string;
};

type PostPayload = {
  job_suggestion?: string;
  [key: string]: unknown;
};

function Stat({
  label,
  value,
  sub,
  emphasis,
}: {
  label: string;
  value: number | string;
  sub?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        emphasis
          ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-black"
          : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
      }`}
    >
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right" | "left";
}) {
  return (
    <th
      className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  className,
  title,
}: {
  children: React.ReactNode;
  align?: "right" | "left";
  className?: string;
  title?: string;
}) {
  return (
    <td
      className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} ${className ?? ""}`}
      title={title}
    >
      {children}
    </td>
  );
}

function ErrorPage({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="text-lg font-semibold mb-2">Analytics — error</h1>
      <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
    </main>
  );
}

function toS(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function fmtDate(s: string): string {
  // Render as `YYYY-MM-DD HH:MM` in the server's local TZ. Researchers in
  // different time zones can rely on the timestamp being consistent at least
  // within their session.
  const d = new Date(s);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
