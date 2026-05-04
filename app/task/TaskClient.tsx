"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SpellcheckTextarea from "./SpellcheckTextarea";
import MarkdownMessage from "@/components/MarkdownMessage";

type ChatMsg = { id: number | string; role: "user" | "assistant"; content: string };

type Condition = "biased" | "neutral" | "control";

// Task brief shown above the biography. Uses full-strength text colour
// (black/white) and one Tailwind size up from the previous text-sm so the
// instructions read like a primary block, not a footnote. The "In your
// response…" line is bolded so participants don't miss the four-question
// structure when scanning.
const TASK_BRIEF = (
  <div className="text-base text-black mb-6 max-w-3xl dark:text-white">
    <p>
      Below is a short biography of a recent university graduate. Based on
      this biography, write a career plan for this person of at least 200
      words.
    </p>
    <p className="mt-3 font-semibold">
      In your response, include the answer of the following in separate
      paragraphs:
    </p>
    <ul className="mt-1 space-y-0.5">
      <li>
        • What single career would this person be most qualified based on
        their demonstrated experience and why?
      </li>
      <li>
        • What personal qualities and strengths should they highlight to
        employers?
      </li>
      <li>
        • How do they work best (e.g. independently, in teams, in leadership,
        in support roles) and why?
      </li>
      <li>
        • What is the biggest challenge this person may face in their
        suggested workplace?
      </li>
    </ul>
  </div>
);

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
  // Pre-submission confirmation modal: a click on Submit no longer fires the
  // POST directly. It first opens a modal asking the participant to confirm
  // they've read what they're about to send; only the modal's confirm button
  // calls the API.
  const [showConfirm, setShowConfirm] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const isControl = condition === "control";

  const userTurns = messages.filter((m) => m.role === "user").length;
  const words = useMemo(
    () => careerPlan.trim().split(/\s+/).filter(Boolean).length,
    [careerPlan],
  );
  // Only a minimum (200) is enforced. Participants may write as many words as
  // they like above that — no upper cap, no warning if they exceed any
  // particular count.
  const wordOk = words >= 200;
  // Control group has no assistant, so the chat-turn gate doesn't apply.
  const turnsOk = isControl ? true : userTurns >= minUserTurns;
  const capReached = !isControl && userTurns >= maxUserTurns;
  // The button used to be disabled when gates weren't met, which silently
  // did nothing on click. Now the button is always clickable (unless a
  // submission is already in flight) and we surface a targeted reason on
  // click — much clearer feedback for the participant.
  const canSubmit = !submitting;

  // Passive, proactive hint shown above the Submit button explaining what's
  // still needed. Kept in sync with the server-side checks in
  // /api/submit/p9vqm2 and the click-time error below.
  const blockingReason = (() => {
    if (!turnsOk) {
      const remaining = minUserTurns - userTurns;
      return `Please chat with the writing assistant at least ${minUserTurns} times before submitting (${remaining} more to go).`;
    }
    if (!wordOk) {
      return `Your plan is ${words} words — please write at least 200.`;
    }
    return null;
  })();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-size the chat textarea to fit its content. Claude-style: grows as
  // the user types or pastes, collapses back to one line after send. Runs in
  // useLayoutEffect so the height is written synchronously after React
  // commits the new value — no visible flicker from a double-render.
  useLayoutEffect(() => {
    const el = chatInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

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

  function onSubmitPlan() {
    // Preflight: surface the same gate message the passive hint shows, so a
    // click always produces visible feedback (red error line) even if the
    // participant skipped the hint.
    if (blockingReason) {
      setSubmitErr(blockingReason);
      return;
    }
    setSubmitErr(null);
    setShowConfirm(true);
  }

  async function confirmSubmit() {
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
      setShowConfirm(false);
      return;
    }
    router.replace("/post");
  }

  const editorSection = (
    <section
      className={`rounded-lg border border-neutral-200 bg-white shadow-sm flex flex-col dark:border-neutral-800 dark:bg-neutral-900 ${PANEL_HEIGHT}`}
    >
      <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between dark:border-neutral-800">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Your career plan
        </h2>
        {/* Word-count indicator lives in the header now. Red while under 200,
            green once the minimum is met. Aligns with the "Writing assistant"
            chat-turn indicator on the other panel's header. */}
        <span
          className={`text-xs ${
            wordOk
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {words} words {wordOk ? "✓" : "(minimum 200)"}
        </span>
      </div>
      <div className="flex-1 p-3 min-h-0">
        <SpellcheckTextarea
          value={careerPlan}
          onChange={setCareerPlan}
          placeholder="Write your career plan here (at least 200 words)…"
        />
      </div>
      <div className="border-t border-neutral-200 px-5 py-3 dark:border-neutral-800">
        {/* Only shown after a Submit click — no passive nagging while the
            participant is still working. The red block is cleared on the next
            successful click-path. */}
        {submitErr && (
          <div className="mt-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:border-red-800/60 dark:text-red-300">
            {submitErr}
          </div>
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

  // Assistant panel gets a subtle sky-blue tint so it's instantly visually
  // distinct from the editor (which keeps the plain white/neutral surface a
  // writing canvas should have). Border + header divider tinted to match so
  // it reads as one cohesive panel, not a default panel with a blue patch.
  const assistantSection = (
    <section
      className={`rounded-lg border border-sky-200 bg-sky-50 shadow-sm flex flex-col dark:border-sky-900/60 dark:bg-sky-950/30 ${PANEL_HEIGHT}`}
    >
      <div className="px-5 py-3 border-b border-sky-200 flex items-center justify-between dark:border-sky-900/60">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          AI assistant
        </h2>
        {/* Combined chat-turn indicator. The leading count is RED while the
            participant hasn't yet hit the chat-turn gate (`minUserTurns`),
            flips GREEN once they have. If they later hit the message cap
            (`maxUserTurns`) the count goes back to RED as a warning. The
            "/ 15" denominator stays neutral throughout. */}
        <span className="text-xs">
          <span
            className={
              capReached
                ? "text-red-600 dark:text-red-400 font-semibold"
                : userTurns >= minUserTurns
                  ? "text-emerald-700 dark:text-emerald-400 font-semibold"
                  : "text-red-600 dark:text-red-400 font-semibold"
            }
          >
            {userTurns}
          </span>
          <span className="text-neutral-500 dark:text-neutral-400">
            {" "}/ {maxUserTurns} used
          </span>
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            I am a helpful writing assistant. Ask me anything!
          </p>
        )}
        {messages.map((m) => {
          // User bubbles render as plain text (their input is never markdown);
          // assistant bubbles go through ReactMarkdown so **bold**, lists,
          // code blocks, etc. render correctly. The `whitespace-pre-wrap`
          // class only applies to user bubbles — markdown handles its own
          // whitespace.
          const isUser = m.role === "user";
          return (
            <div
              key={m.id}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                  isUser
                    ? "whitespace-pre-wrap bg-black text-white dark:bg-white dark:text-black"
                    : "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                }`}
              >
                {isUser ? (
                  m.content
                ) : m.content ? (
                  <MarkdownMessage content={m.content} />
                ) : streaming ? (
                  "…"
                ) : (
                  ""
                )}
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>
      <div className="border-t border-sky-200 p-3 dark:border-sky-900/60">
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
          // items-end so the Send button stays aligned with the last visible
          // line as the textarea grows taller.
          className="flex items-end gap-2"
        >
          <textarea
            ref={chatInputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter inserts a newline (default textarea
              // behaviour, so no preventDefault). On IME composition (Chinese/
              // Japanese input) e.nativeEvent.isComposing is true — don't send
              // mid-composition, let the IME consume Enter.
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                sendMessage();
              }
            }}
            rows={1}
            disabled={streaming || capReached}
            placeholder={
              capReached
                ? "Message limit reached"
                : "Type a message… (Shift+Enter for new line)"
            }
            // resize-none: user can't drag-resize; we control height via
            // autosize. No max-height cap — the textarea grows to fit the
            // full prompt, Claude-style. The parent section has a fixed
            // height (PANEL_HEIGHT), so as the textarea grows the messages
            // list above (flex-1) shrinks. The overall panel stays put.
            className="flex-1 resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm leading-6 disabled:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:disabled:bg-neutral-800"
          />
          <button
            disabled={streaming || capReached || !input.trim()}
            className="shrink-0 rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
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
        {TASK_BRIEF}

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

      {/*
        Pre-submission confirmation. Click "Yes, submit" → fires the API call.
        Click "Go back and review" → just dismisses the modal so the
        participant can keep editing. While `submitting` is true the buttons
        lock so a double-click can't fire two requests.
      */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-confirm-title"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-neutral-900">
            <h3
              id="submit-confirm-title"
              className="text-base font-semibold mb-2"
            >
              Have you carefully read what you&apos;re about to submit?
            </h3>
            <p className="text-sm text-neutral-600 mb-5 dark:text-neutral-400">
              Once submitted, you can&apos;t change your career plan.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
              >
                Go back and review
              </button>
              <button
                type="button"
                onClick={confirmSubmit}
                disabled={submitting}
                className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
              >
                {submitting ? "Submitting…" : "Yes, submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
