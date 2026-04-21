"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say", "Self-describe"];
const YEAR_LEVELS = [
  "Undergraduate Y1",
  "Undergraduate Y2",
  "Undergraduate Y3",
  "Undergraduate Y4",
  "Master's",
  "PhD",
  "Other",
];
const LIKERT_FREQ = ["Never", "Rarely", "Sometimes", "Often", "Daily"];
const LIKERT_CONF = ["Not at all", "Slightly", "Moderately", "Quite", "Very confident"];

export default function IntakeForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    age: "",
    gender: "",
    gender_self: "",
    university: "",
    year_level: "",
    field_of_study: "",
    ai_use_frequency: 0,
    ai_confidence: 0,
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (
      !form.age ||
      !form.gender ||
      !form.university ||
      !form.year_level ||
      !form.field_of_study ||
      !form.ai_use_frequency ||
      !form.ai_confidence
    ) {
      setError("Please complete every field.");
      return;
    }
    setSubmitting(true);
    const gender =
      form.gender === "Self-describe" && form.gender_self
        ? form.gender_self
        : form.gender;
    const res = await fetch("/api/intake/b6fy5c", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        age: Number(form.age),
        gender,
        university: form.university,
        year_level: form.year_level,
        field_of_study: form.field_of_study,
        ai_use_frequency: form.ai_use_frequency,
        ai_confidence: form.ai_confidence,
      }),
    });
    if (!res.ok) {
      setSubmitting(false);
      setError("Something went wrong. Please try again.");
      return;
    }
    router.push("/task");
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold mb-4">About you</h1>
      <p className="text-sm text-neutral-600 mb-6">
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

        {error && <div className="text-sm text-red-600">{error}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {submitting ? "Saving…" : "Continue"}
        </button>
      </form>

      <style jsx global>{`
        .input {
          width: 100%;
          border: 1px solid rgb(212 212 212);
          border-radius: 0.375rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          background: white;
        }
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
      <div className="flex flex-wrap gap-2">
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
