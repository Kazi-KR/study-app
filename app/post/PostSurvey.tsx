"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Condition = "biased" | "neutral" | "control";

const AGREE_LABELS = [
  "Strongly disagree",
  "Disagree",
  "Neutral",
  "Agree",
  "Strongly agree",
];

const EDIT_LABELS = [
  "Not at all",
  "Slightly",
  "Moderately",
  "Quite a bit",
  "Extensively",
];

// AI-block Likerts. Order matters: this is what determines question numbers
// shown to the participant. `ai_influenced_career` is asked first (right
// after the open-ended job-suggestion question above) so the two
// career-related items sit back-to-back. All four AI-influence questions use
// the magnitude ("edit") scale — "Not at all → Extensively" — since the new
// wording is "How much…" rather than agree/disagree statements.
const USAGE_LIKERTS: { key: string; label: string; scale: "agree" | "edit" }[] = [
  {
    key: "ai_influenced_career",
    label:
      "How much did the AI assistant influence the career you recommended?",
    scale: "edit",
  },
  {
    key: "influence",
    label: "How much did the AI assistant influence what you wrote?",
    scale: "edit",
  },
  {
    key: "edit_amount",
    label: "How much did you edit the AI assistants suggestions?",
    scale: "edit",
  },
];

const USAGE_PATTERNS: { key: string; label: string }[] = [
  {
    key: "a",
    label: "I asked for general career advice without sharing the biography",
  },
  {
    key: "b",
    label: "I shared parts of the biography and asked for suggestions",
  },
  {
    key: "c",
    label:
      "I shared the full biography and asked the AI to help write the career plan",
  },
  {
    key: "d",
    label:
      "I asked the AI to write the career plan entirely and then edited it",
  },
  {
    key: "e",
    label: "I chose a career and had the AI assistant write about it",
  },
  { key: "other", label: "Other (please specify)" },
];

// Rendered after the usage-pattern picker. `ai_influenced_career` moved up
// into USAGE_LIKERTS, so this list now contains the two remaining
// AI-influence questions. Same magnitude scale ("Not at all → Extensively")
// is applied at render time below.
const PERCEIVED_ITEMS: { key: string; label: string }[] = [
  {
    key: "ai_influenced_strengths",
    label:
      "How much did the AI assistant influence how you described the person's strengths?",
  },
  {
    key: "would_have_differed",
    label:
      "How different do you think your response would have been without the AI assistant?",
  },
];

export default function PostSurvey({ condition }: { condition: Condition }) {
  const router = useRouter();
  const isControl = condition === "control";

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [jobSuggestion, setJobSuggestion] = useState("");
  const [usagePattern, setUsagePattern] = useState<string>("");
  const [usageOther, setUsageOther] = useState("");
  const [noticed, setNoticed] = useState("");
  const [studyGuess, setStudyGuess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredLikerts = isControl
    ? []
    : [...USAGE_LIKERTS, ...PERCEIVED_ITEMS];

  const allLikertsAnswered = requiredLikerts.every((i) => answers[i.key]);
  const usagePatternOk =
    isControl ||
    (usagePattern !== "" &&
      (usagePattern !== "other" || usageOther.trim().length > 0));
  const jobSuggestionOk = jobSuggestion.trim().length > 0;

  const allAnswered = allLikertsAnswered && usagePatternOk && jobSuggestionOk;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allAnswered) {
      setError(
        !jobSuggestionOk
          ? "Please answer the first question about the job you suggested."
          : isControl
            ? "Please answer the remaining items."
            : "Please answer every item, including the usage pattern.",
      );
      return;
    }
    setError(null);
    setSubmitting(true);

    const payload: {
      kind: "post";
      likert: Record<string, number>;
      job_suggestion: string;
      usage_pattern?: string;
      usage_pattern_other?: string;
      noticed_anything?: string;
      study_guess: string;
    } = {
      kind: "post",
      likert: answers,
      job_suggestion: jobSuggestion.trim(),
      study_guess: studyGuess,
    };
    if (!isControl) {
      payload.usage_pattern = usagePattern;
      payload.usage_pattern_other =
        usagePattern === "other" ? usageOther : "";
      payload.noticed_anything = noticed;
    }

    const res = await fetch("/api/survey/t4nz8r", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setSubmitting(false);
      setError("Something went wrong.");
      return;
    }
    router.replace("/end");
  }

  // Simple render-time counter so every question gets a sequential number
  // without tracking indices by hand. Resets on every render (safe in React
  // because render is synchronous top-to-bottom for a single component).
  let qn = 0;
  const num = () => ++qn;

  function likertRow(
    item: { key: string; label: string; scale?: "agree" | "edit" },
  ) {
    const labels = item.scale === "edit" ? EDIT_LABELS : AGREE_LABELS;
    const n = num();
    return (
      <div key={item.key}>
        <div className="text-sm font-medium mb-2">
          {n}. {item.label}
        </div>
        <div className="flex flex-wrap gap-2">
          {labels.map((o, i) => {
            const v = i + 1;
            return (
              <button
                type="button"
                key={o}
                onClick={() => setAnswers((a) => ({ ...a, [item.key]: v }))}
                className={`pill ${answers[item.key] === v ? "pill-on" : ""}`}
              >
                {v}. {o}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold mb-4">A few last questions</h1>
      <p className="text-sm text-neutral-600 mb-6 dark:text-neutral-400">
        {isControl
          ? "A final question before you finish."
          : "Please answer every item below."}
      </p>

      <form onSubmit={onSubmit} className="space-y-6">
        {/*
          First question, asked of every condition: free-text job suggestion
          the participant put in their career plan. Renders before the
          AI-specific block so the numbering ({num()}) starts here.
        */}
        <label className="block">
          <span className="text-sm font-medium mb-1 block">
            {num()}. What job or occupation did you suggest for that person in
            your career plan?
          </span>
          <textarea
            value={jobSuggestion}
            onChange={(e) => setJobSuggestion(e.target.value)}
            className="w-full min-h-[80px] rounded-md border border-neutral-300 bg-white p-3 text-sm leading-6 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
            placeholder="A short answer is fine — e.g. 'data analyst', 'teacher', 'product manager'."
          />
        </label>

        {!isControl && (
          <>
            {USAGE_LIKERTS.map(likertRow)}

            <div>
              <div className="text-sm font-medium mb-2">
                {num()}. How did you primarily use the AI assistant?
              </div>
              <div className="space-y-2">
                {USAGE_PATTERNS.map((opt) => (
                  <label
                    key={opt.key}
                    className="flex items-start gap-3 text-sm cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="usage_pattern"
                      value={opt.key}
                      checked={usagePattern === opt.key}
                      onChange={() => setUsagePattern(opt.key)}
                      className="mt-1"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
              {usagePattern === "other" && (
                <input
                  type="text"
                  value={usageOther}
                  onChange={(e) => setUsageOther(e.target.value)}
                  placeholder="Please specify…"
                  className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                />
              )}
            </div>

            {PERCEIVED_ITEMS.map((i) => likertRow({ ...i, scale: "edit" }))}

            <label className="block">
              <span className="text-sm font-medium mb-1 block">
                {num()}. Did you notice anything unusual about the AI&apos;s
                suggestions?
              </span>
              <textarea
                value={noticed}
                onChange={(e) => setNoticed(e.target.value)}
                className="w-full min-h-[90px] rounded-md border border-neutral-300 bg-white p-3 text-sm leading-6 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                placeholder="Open-ended — leave blank if nothing stood out"
              />
            </label>
          </>
        )}

        <label className="block">
          <span className="text-sm font-medium mb-1 block">
            {num()}. What do you think this study was about?
          </span>
          <textarea
            value={studyGuess}
            onChange={(e) => setStudyGuess(e.target.value)}
            className="w-full min-h-[90px] rounded-md border border-neutral-300 p-3 text-sm leading-6"
            placeholder="Your best guess — there are no right or wrong answers"
          />
        </label>

        {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          {submitting ? "Submitting…" : "Continue"}
        </button>
      </form>

      <style jsx global>{`
        .pill {
          border: 1px solid var(--border);
          border-radius: 9999px;
          padding: 0.375rem 0.875rem;
          font-size: 0.8125rem;
          background: var(--input-bg);
          color: var(--foreground);
          cursor: pointer;
        }
        .pill-on {
          background: var(--foreground);
          color: var(--background);
          border-color: var(--foreground);
        }
      `}</style>
    </main>
  );
}
