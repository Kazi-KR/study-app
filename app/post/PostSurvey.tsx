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

const USAGE_LIKERTS: { key: string; label: string; scale: "agree" | "edit" }[] = [
  {
    key: "influence",
    label: "The assistant noticeably influenced what I wrote.",
    scale: "agree",
  },
  {
    key: "edit_amount",
    label: "How much did you edit the AI's suggestions?",
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
  { key: "other", label: "Other (please specify)" },
];

const PERCEIVED_ITEMS: { key: string; label: string }[] = [
  {
    key: "ai_influenced_career",
    label: "The AI assistant influenced the career I recommended.",
  },
  {
    key: "ai_influenced_strengths",
    label:
      "The AI assistant influenced how I described the person's strengths.",
  },
  {
    key: "would_have_differed",
    label: "I would have written something different without the AI.",
  },
];

export default function PostSurvey({ condition }: { condition: Condition }) {
  const router = useRouter();
  const isControl = condition === "control";

  const [answers, setAnswers] = useState<Record<string, number>>({});
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

  const allAnswered = allLikertsAnswered && usagePatternOk;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allAnswered) {
      setError(
        isControl
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
      usage_pattern?: string;
      usage_pattern_other?: string;
      noticed_anything?: string;
      study_guess: string;
    } = {
      kind: "post",
      likert: answers,
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
    router.push("/end");
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
      <p className="text-sm text-neutral-600 mb-6">
        {isControl
          ? "A final question before you finish."
          : "Please answer every item below."}
      </p>

      <form onSubmit={onSubmit} className="space-y-6">
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
                  className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
              )}
            </div>

            {PERCEIVED_ITEMS.map((i) => likertRow({ ...i, scale: "agree" }))}

            <label className="block">
              <span className="text-sm font-medium mb-1 block">
                {num()}. Did you notice anything unusual about the AI&apos;s
                suggestions?
              </span>
              <textarea
                value={noticed}
                onChange={(e) => setNoticed(e.target.value)}
                className="w-full min-h-[90px] rounded-md border border-neutral-300 p-3 text-sm leading-6"
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

        {error && <div className="text-sm text-red-600">{error}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {submitting ? "Submitting…" : "Continue"}
        </button>
      </form>

      <style jsx global>{`
        .pill {
          border: 1px solid rgb(212 212 212);
          border-radius: 9999px;
          padding: 0.375rem 0.875rem;
          font-size: 0.8125rem;
          background: white;
          cursor: pointer;
        }
        .pill-on {
          background: black;
          color: white;
          border-color: black;
        }
      `}</style>
    </main>
  );
}
