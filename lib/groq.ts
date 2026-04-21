import "server-only";
import Groq from "groq-sdk";
import { db } from "@/lib/db";
import {
  BIASED_PROMPT,
  NEUTRAL_PROMPT,
  PROMPT_VERSION,
} from "@/lib/prompts";
import type { Condition } from "@/lib/conditions";

const MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const TEMPERATURE = Number(process.env.GROQ_TEMPERATURE ?? "0.7");
const MAX_RETRIES = 3;
const COOLDOWN_MS = 30_000;

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function loadKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const k = process.env[`GROQ_API_KEY_${i}`];
    if (k && k.trim()) keys.push(k.trim());
  }
  // Fallback to a single GROQ_API_KEY if the numbered vars aren't set.
  if (keys.length === 0 && process.env.GROQ_API_KEY) {
    keys.push(process.env.GROQ_API_KEY);
  }
  if (keys.length === 0) {
    throw new Error(
      "No Groq API keys configured. Set GROQ_API_KEY_1..5 or GROQ_API_KEY.",
    );
  }
  return keys;
}

const cooldowns = new Map<number, number>(); // key_index -> epoch ms to wake

function pickOrder(n: number): number[] {
  const start = Math.floor(Math.random() * n);
  const order: number[] = [];
  for (let i = 0; i < n; i++) order.push((start + i) % n);
  const now = Date.now();
  return order.sort((a, b) => {
    const ca = (cooldowns.get(a) ?? 0) <= now ? 0 : 1;
    const cb = (cooldowns.get(b) ?? 0) <= now ? 0 : 1;
    return ca - cb;
  });
}

export function systemPromptFor(condition: Condition): string {
  return condition === "biased" ? BIASED_PROMPT : NEUTRAL_PROMPT;
}

export function buildMessages(
  condition: Condition,
  history: ChatMessage[],
): ChatMessage[] {
  const system = systemPromptFor(condition);
  return [{ role: "system", content: system }, ...history];
}

export type GroqStreamResult = {
  stream: AsyncIterable<string>;
  done: Promise<{
    content: string;
    keyIndex: number;
    retryCount: number;
    promptTokens?: number;
    completionTokens?: number;
    latencyMs: number;
  }>;
};

export async function streamChat(
  messages: ChatMessage[],
  sessionId: string | null,
): Promise<GroqStreamResult> {
  const keys = loadKeys();
  const order = pickOrder(keys.length);
  const start = Date.now();
  let lastErr: unknown = null;

  for (let attempt = 0; attempt < Math.min(MAX_RETRIES, order.length); attempt++) {
    const keyIndex = order[attempt];
    const client = new Groq({ apiKey: keys[keyIndex] });
    try {
      const completion = await client.chat.completions.create({
        model: MODEL,
        temperature: TEMPERATURE,
        stream: true,
        messages,
      });

      let buf = "";
      let promptTokens: number | undefined;
      let completionTokens: number | undefined;

      async function* iterator() {
        for await (const chunk of completion) {
          const delta = chunk.choices?.[0]?.delta?.content ?? "";
          if (delta) {
            buf += delta;
            yield delta;
          }
          const usage = (chunk as unknown as { x_groq?: { usage?: { prompt_tokens?: number; completion_tokens?: number } } }).x_groq?.usage;
          if (usage) {
            promptTokens = usage.prompt_tokens;
            completionTokens = usage.completion_tokens;
          }
        }
      }

      const iter = iterator();

      // done resolves when caller finishes consuming the stream.
      const done = (async () => {
        const latencyMs = Date.now() - start;
        await logCall({
          sessionId,
          keyIndex,
          statusCode: 200,
          retryCount: attempt,
          promptTokens,
          completionTokens,
          latencyMs,
        });
        return {
          content: buf,
          keyIndex,
          retryCount: attempt,
          promptTokens,
          completionTokens,
          latencyMs,
        };
      })();

      return {
        stream: (async function* () {
          for await (const d of iter) yield d;
        })(),
        done,
      };
    } catch (err: unknown) {
      lastErr = err;
      const status = extractStatus(err);
      await logCall({
        sessionId,
        keyIndex,
        statusCode: status ?? 0,
        retryCount: attempt,
        latencyMs: Date.now() - start,
        error: errorMessage(err),
      });
      if (status === 429 || status === 503) {
        cooldowns.set(keyIndex, Date.now() + COOLDOWN_MS);
        continue;
      }
      // Non-rate-limit error: don't burn other keys; bail.
      throw err;
    }
  }
  throw lastErr ?? new Error("All Groq keys exhausted");
}

function extractStatus(err: unknown): number | null {
  if (err && typeof err === "object" && "status" in err) {
    const s = (err as { status?: unknown }).status;
    return typeof s === "number" ? s : null;
  }
  return null;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try { return JSON.stringify(err); } catch { return String(err); }
}

async function logCall(args: {
  sessionId: string | null;
  keyIndex: number;
  statusCode: number;
  retryCount: number;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs: number;
  error?: string;
}) {
  try {
    await db().from("groq_calls").insert({
      session_id: args.sessionId,
      key_index: args.keyIndex,
      status_code: args.statusCode,
      retry_count: args.retryCount,
      prompt_tokens: args.promptTokens ?? null,
      completion_tokens: args.completionTokens ?? null,
      latency_ms: args.latencyMs,
      error: args.error ?? null,
    });
  } catch {
    // Telemetry failures must never break the user-facing call.
  }
}

export { PROMPT_VERSION, MODEL };
