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
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex items-baseline justify-between mb-4">
          <h1 className="text-xl font-semibold">Researcher preview</h1>
          <span className="text-xs text-neutral-500">
            Not logged to the study database.
          </span>
        </div>

        <div className="rounded-lg border bg-white p-4 shadow-sm mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-xs font-medium text-neutral-500 uppercase">
              Biography
            </span>
            <select
              value={bioId}
              onChange={(e) => {
                setBioId(e.target.value);
                resetChat();
              }}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            >
              {biographies.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.id} — {b.subject_name} ({b.subject_gender})
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-500 uppercase">
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
                      ? "bg-black text-white border-black"
                      : "border-neutral-300 bg-white"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-500 uppercase">
              Admin token
            </span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="EXPORT_TOKEN value"
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="rounded-lg border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-2">
              Biography ({bio?.pair_id} / {bio?.subject_gender})
            </h2>
            <p className="text-sm leading-6 whitespace-pre-line">{bio?.text}</p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={resetChat}
                className="text-xs text-neutral-500 hover:text-neutral-800 underline"
              >
                Reset chat
              </button>
            </div>
          </section>

          <section className="rounded-lg border bg-white shadow-sm flex flex-col h-[80vh] min-h-[600px]">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Assistant ({condition})
              </h2>
              <span className="text-xs text-neutral-500">{messages.length} messages</span>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {messages.length === 0 && (
                <p className="text-sm text-neutral-500">
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
                        ? "bg-black text-white"
                        : "bg-neutral-100 text-neutral-900"
                    }`}
                  >
                    {m.content || (m.role === "assistant" && streaming ? "…" : "")}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            {error && (
              <div className="px-5 py-2 text-sm text-red-600 border-t bg-red-50">
                {error}
              </div>
            )}
            <div className="border-t p-3">
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
                  className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
                />
                <button
                  disabled={streaming || !input.trim()}
                  className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
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
