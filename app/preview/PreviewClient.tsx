"use client";

import { useEffect, useRef, useState } from "react";

type Bio = {
  id: string;
  pair_id: string;
  subject_gender: "male" | "female";
  subject_name: string;
  text: string;
};

type ChatMsg = { id: string; role: "user" | "assistant"; content: string };

type Condition = "neutral" | "biased";

export default function PreviewClient({ biographies }: { biographies: Bio[] }) {
  const [token, setToken] = useState("");
  const [bioId, setBioId] = useState(biographies[0]?.id ?? "");
  const [condition, setCondition] = useState<Condition>("neutral");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Persist the token locally for convenience during a research session.
    const stored = typeof window !== "undefined" ? sessionStorage.getItem("preview_token") : null;
    if (stored) setToken(stored);
  }, []);

  useEffect(() => {
    if (token) sessionStorage.setItem("preview_token", token);
  }, [token]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const bio = biographies.find((b) => b.id === bioId);

  function resetChat() {
    setMessages([]);
    setError(null);
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    if (!token) {
      setError("Enter your admin token first.");
      return;
    }
    setError(null);
    setInput("");

    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: "user", content: text };
    const assistantMsg: ChatMsg = { id: `a-${Date.now()}`, role: "assistant", content: "" };
    const nextHistory: ChatMsg[] = [...messages, userMsg];
    setMessages([...nextHistory, assistantMsg]);
    setStreaming(true);

    try {
      const res = await fetch("/api/preview-chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify({
          biography_id: bioId,
          condition,
          messages: nextHistory.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
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
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMessages((m) => m.slice(0, -1)); // remove empty assistant bubble
    } finally {
      setStreaming(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex items-baseline justify-between mb-4">
          <h1 className="text-xl font-semibold">Researcher preview</h1>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            Not logged to the study database.
          </span>
        </div>

        {/* Quick-access links to the three participant entry URLs. Open in a
            new tab so the researcher's preview session (admin token in
            sessionStorage) isn't disturbed. Colors invert for dark theme. */}
        <div className="mb-4 flex flex-wrap gap-2">
          <a
            href="/study/a"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-white dark:text-black"
          >
            BIAS STUDY
          </a>
          <a
            href="/study/b"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-white dark:text-black"
          >
            NEUTRAL STUDY
          </a>
          <a
            href="/study/c"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-white dark:text-black"
          >
            CONTROL STUDY
          </a>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm mb-4 grid grid-cols-1 md:grid-cols-4 gap-3 dark:border-neutral-800 dark:bg-neutral-900">
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
              Biography
            </span>
            <select
              value={bioId}
              onChange={(e) => {
                setBioId(e.target.value);
                resetChat();
              }}
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              {biographies.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.id} — {b.subject_name} ({b.subject_gender})
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
              Condition
            </span>
            <div className="flex gap-2">
              {(["neutral", "biased"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setCondition(c);
                    resetChat();
                  }}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                    condition === c
                      ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
                      : "border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
              Admin token
            </span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="EXPORT_TOKEN value"
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-2 dark:text-neutral-400">
              Biography ({bio?.pair_id} / {bio?.subject_gender})
            </h2>
            <p className="text-sm leading-6 whitespace-pre-line">{bio?.text}</p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={resetChat}
                className="text-xs text-neutral-500 hover:text-neutral-800 underline dark:text-neutral-400 dark:hover:text-neutral-200"
              >
                Reset chat
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white shadow-sm flex flex-col h-[80vh] min-h-[600px] dark:border-neutral-800 dark:bg-neutral-900">
            <div className="px-5 py-3 border-b border-neutral-200 flex items-center justify-between dark:border-neutral-800">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Assistant ({condition})
              </h2>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">{messages.length} messages</span>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {messages.length === 0 && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Send a message to probe the assistant with the selected biography and condition.
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
            {error && (
              <div className="px-5 py-2 text-sm text-red-600 border-t border-neutral-200 bg-red-50 dark:border-neutral-800 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            )}
            <div className="border-t border-neutral-200 p-3 dark:border-neutral-800">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="flex gap-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={streaming}
                  placeholder="Message the assistant…"
                  className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                />
                <button
                  disabled={streaming || !input.trim()}
                  className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
                >
                  Send
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
