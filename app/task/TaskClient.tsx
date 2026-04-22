"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SpellcheckTextarea from "./SpellcheckTextarea";

type ChatMsg = { id: number | string; role: "user" | "assistant"; content: string };

type Condition = "biased" | "neutral" | "control";

const TASK_BRIEF = `Below is a short biography of a recent university graduate. Based on this biography, write a 200–300 word career plan for this person.

In your response, include:
• What career path would suit them and why
• What personal qualities and strengths they should highlight to employers
• How they work best — independently, in teams, in leadership, in support roles — and why
• What is the biggest challenge or barrier this person may face in their career`;

// Shared height for the editor + assistant columns so they line up visually.
const PANEL_HEIGHT = "h-[70vh] min-h-[520px]";

export default function TaskClient({
  biography,
  initialMessages,
  minUserTurns,
  maxUserTurns,
  condition,
}: {
  biography: string;
  initialMessages: ChatMsg[];
  minUserTurns: number;
  maxUserTurns: number;
  condition: Condition;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMsg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [careerPlan, setCareerPlan] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isControl = condition === "control";

  const userTurns = messages.filter((m) => m.role === "user").length;
  const words = useMemo(
    () => careerPlan.trim().split(/\s+/).filter(Boolean).length,
    [careerPlan],
  );
  const wordOk = words >= 200 && words <= 300;
  // Control group has no assistant, so the chat-turn gate doesn't apply.
  const turnsOk = isControl ? true : userTurns >= minUserTurns;
  const capReached = !isControl && userTurns >= maxUserTurns;
  const canSubmit = wordOk && turnsOk && !submitting;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming || capReached || isControl) return;
    setInput("");
    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: "user", content: text };
    const assistantMsg: ChatMsg = {
      id: `a-${Date.now()}`,
      role: "assistant",
      content: "",
    };
    setMessages((m) => [...m, userMsg, assistantMsg]);
    setStreaming(true);

    try {
      const res = await fetch("/api/chat/k7wn3x", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`Chat failed: ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = m.slice();
          copy[copy.length - 1] = { ...copy[copy.length - 1], content: acc };
          return copy;
        });
      }
    } catch (err) {
      setMessages((m) => {
        const copy = m.slice();
        copy[copy.length - 1] = {
          ...copy[copy.length - 1],
          content: "Sorry, something went wrong. Please try again.",
        };
        return copy;
      });
      console.error(err);
    } finally {
      setStreaming(false);
    }
  }

  async function onSubmitPlan() {
    setSubmitErr(null);
    setSubmitting(true);
    const res = await fetch("/api/submit/p9vqm2", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ final_text: careerPlan }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSubmitErr(body.error ?? "Submission failed.");
      setSubmitting(false);
      return;
    }
    router.push("/post");
  }

  const editorSection = (
    <section
      className={`rounded-lg border border-neutral-200 bg-white shadow-sm flex flex-col dark:border-neutral-800 dark:bg-neutral-900 ${PANEL_HEIGHT}`}
    >
      <div className="px-5 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Your career plan (200–300 words)
        </h2>
      </div>
      <div className="flex-1 p-3 min-h-0">
        <SpellcheckTextarea
          value={careerPlan}
          onChange={setCareerPlan}
          placeholder="Write your 200–300 word career plan here…"
        />
      </div>
      <div className="border-t border-neutral-200 px-5 py-3 dark:border-neutral-800">
        <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
          <span className={wordOk ? "text-emerald-700 dark:text-emerald-400" : ""}>
            {words} words {wordOk ? "✓" : "(target: 200–300)"}
          </span>
          {!isControl && (
            <span className={turnsOk ? "text-emerald-700 dark:text-emerald-400" : ""}>
              {userTurns} / {minUserTurns} chat turns{" "}
              {turnsOk ? "✓" : "(minimum required)"}
            </span>
          )}
        </div>
        {submitErr && (
          <div className="mt-2 text-sm text-red-600 dark:text-red-400">{submitErr}</div>
        )}
        <button
          disabled={!canSubmit}
          onClick={onSubmitPlan}
          className="mt-3 rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          {submitting ? "Submitting…" : "Submit career plan"}
        </button>
      </div>
    </section>
  );

  const assistantSection = (
    <section
      className={`rounded-lg border border-neutral-200 bg-white shadow-sm flex flex-col dark:border-neutral-800 dark:bg-neutral-900 ${PANEL_HEIGHT}`}
    >
      <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between dark:border-neutral-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Writing assistant
        </h2>
        <span
          className={`text-xs ${capReached ? "text-red-600 dark:text-red-400" : "text-neutral-500 dark:text-neutral-400"}`}
        >
          {userTurns} / {maxUserTurns} used
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Ask the assistant for help thinking through the biography and drafting
            your plan.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-6 whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
              }`}
            >
              {m.content || (m.role === "assistant" && streaming ? "…" : "")}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <div className="border-t border-neutral-200 p-3 dark:border-neutral-800">
        {capReached && (
          <div className="mb-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:border-amber-900 dark:text-amber-200">
            You&apos;ve reached the {maxUserTurns}-message limit. You can still
            submit your career plan.
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={streaming || capReached}
            placeholder={
              capReached ? "Message limit reached" : "Type a message…"
            }
            className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm disabled:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:disabled:bg-neutral-800"
          />
          <button
            disabled={streaming || capReached || !input.trim()}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
          >
            Send
          </button>
        </form>
      </div>
    </section>
  );

  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="text-xl font-semibold mb-2">Career Plan Task</h1>
        <p className="text-sm text-neutral-600 mb-6 max-w-3xl whitespace-pre-line dark:text-neutral-400">
          {TASK_BRIEF}
        </p>

        {/* Biography on top, full width. */}
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm mb-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-2 dark:text-neutral-400">
            Biography
          </h2>
          <p className="text-sm leading-6 whitespace-pre-line">{biography}</p>
        </div>

        {/* Editor + assistant side by side (or editor alone for control). */}
        {isControl ? (
          <div className="grid grid-cols-1">{editorSection}</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {editorSection}
            {assistantSection}
          </div>
        )}
      </div>
    </main>
  );
}
