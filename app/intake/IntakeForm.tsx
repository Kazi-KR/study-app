"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say", "Self-describe"];
const YEAR_LEVELS = [
  "Undergraduate Year 1",
  "Undergraduate Year 2",
  "Undergraduate Year 3",
  "Undergraduate Year 4",
  "Master's",
  "PhD",
  "Other",
];
const LIKERT_FREQ = ["Never", "Rarely", "Sometimes", "Often", "Daily"];
const LIKERT_CONF = ["Not at all", "Slightly", "Moderately", "Quite", "Very confident"];
// Self-rated English writing ability — asked of every participant before the
// essay-writing frequency question. Five-point scale; the numeric 1–5 value
// is what gets stored.
const LIKERT_ENGLISH = ["Very poor", "Poor", "Average", "Good", "Excellent"];
// Essay-writing frequency options (asked of every participant regardless of
// condition). Five-point scale to match the existing Likert UI; the numeric
// 1–5 value is what gets stored.
const LIKERT_ESSAY = [
  "Never",
  "A few times a year",
  "About once a month",
  "A few times a month",
  "Weekly or more often",
];

type Condition = "biased" | "neutral" | "control";

export default function IntakeForm({ condition }: { condition: Condition }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Control (no-AI) participants don't see the AI questions, so we don't
  // store/submit those values for them — they stay 0 and are stripped from
  // the payload below.
  const showAiQuestions = condition !== "control";
  const [form, setForm] = useState({
    age: "",
    gender: "",
    gender_self: "",
    university: "BRAC University",
    year_level: "",
    field_of_study: "Computer Science and Engineering",
    english_proficiency: 0,
    essay_writing_frequency: 0,
    ai_use_frequency: 0,
    ai_confidence: 0,
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const baseMissing =
      !form.age ||
      !form.gender ||
      !form.university ||
      !form.year_level ||
      !form.field_of_study ||
      !form.english_proficiency ||
      !form.essay_writing_frequency;
    const aiMissing =
      showAiQuestions && (!form.ai_use_frequency || !form.ai_confidence);
    if (baseMissing || aiMissing) {
      setError("Please complete every field.");
      return;
    }
    setSubmitting(true);
    const gender =
      form.gender === "Self-describe" && form.gender_self
        ? form.gender_self
        : form.gender;
    const payload: Record<string, unknown> = {
      age: Number(form.age),
      gender,
      university: form.university,
      year_level: form.year_level,
      field_of_study: form.field_of_study,
      english_proficiency: form.english_proficiency,
      essay_writing_frequency: form.essay_writing_frequency,
    };
    if (showAiQuestions) {
      payload.ai_use_frequency = form.ai_use_frequency;
      payload.ai_confidence = form.ai_confidence;
    }
    const res = await fetch("/api/intake/b6fy5c", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setSubmitting(false);
      setError("Something went wrong. Please try again.");
      return;
    }
    router.replace("/task");
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold mb-4">About you</h1>
      <p className="text-sm text-neutral-600 mb-6 dark:text-neutral-400">
        A few short questions before the main task. All answers are anonymous.
      </p>
      <form onSubmit={onSubmit} className="space-y-5">
        <Field label="Age">
          <input
            type="number"
            min={18}
            max={100}
            value={form.age}
            onChange={(e) => update("age", e.target.value)}
            className="input"
          />
        </Field>

        <Field label="Gender">
          <div className="flex flex-wrap gap-2">
            {GENDERS.map((g) => (
              <button
                type="button"
                key={g}
                onClick={() => update("gender", g)}
                className={`pill ${form.gender === g ? "pill-on" : ""}`}
              >
                {g}
              </button>
            ))}
          </div>
          {form.gender === "Self-describe" && (
            <input
              type="text"
              placeholder="Please describe"
              value={form.gender_self}
              onChange={(e) => update("gender_self", e.target.value)}
              className="input mt-2"
            />
          )}
        </Field>

        <Field label="University">
          <input
            type="text"
            value={form.university}
            onChange={(e) => update("university", e.target.value)}
            className="input"
          />
        </Field>

        <Field label="Year / academic level">
          <select
            value={form.year_level}
            onChange={(e) => update("year_level", e.target.value)}
            className="input"
          >
            <option value="">Select…</option>
            {YEAR_LEVELS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Field of study">
          <input
            type="text"
            value={form.field_of_study}
            onChange={(e) => update("field_of_study", e.target.value)}
            className="input"
          />
        </Field>

        <Likert
          label="How would you rate your English writing proficiency?"
          options={LIKERT_ENGLISH}
          value={form.english_proficiency}
          onChange={(v) => update("english_proficiency", v)}
        />

        <Likert
          label="How often do you write essay-style responses for academic, personal or professional purposes?"
          options={LIKERT_ESSAY}
          value={form.essay_writing_frequency}
          onChange={(v) => update("essay_writing_frequency", v)}
        />

        {showAiQuestions && (
          <>
            <Likert
              label="How often do you use AI writing tools (e.g., ChatGPT)?"
              options={LIKERT_FREQ}
              value={form.ai_use_frequency}
              onChange={(v) => update("ai_use_frequency", v)}
            />

            <Likert
              label="How confident are you in using AI tools for writing tasks?"
              options={LIKERT_CONF}
              value={form.ai_confidence}
              onChange={(v) => update("ai_confidence", v)}
            />
          </>
        )}

        {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          {submitting ? "Saving…" : "Continue"}
        </button>
      </form>

      <style jsx global>{`
        /* Source from CSS variables so the light/dark toggle just works. */
        .input {
          width: 100%;
          border: 1px solid var(--border);
          border-radius: 0.375rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          background: var(--input-bg);
          color: var(--foreground);
        }
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Likert({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="text-sm font-medium mb-2">{label}</div>
      {/* No-wrap so all option pills sit on a single row. Falls back to a
          horizontal scroll on viewports too narrow to fit them all (e.g.
          phones at long-label scales like the essay-frequency Likert). */}
      <div className="flex gap-2 overflow-x-auto">
        {options.map((o, i) => {
          const v = i + 1;
          return (
            <button
              type="button"
              key={o}
              onClick={() => onChange(v)}
              className={`pill ${value === v ? "pill-on" : ""}`}
            >
              {v}. {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}
