import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { loadParticipant, loadSessionId } from "@/lib/session";
import { buildMessages, streamChat } from "@/lib/groq";
import { approxTokens } from "@/lib/tokens";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  content: z.string().min(1).max(4000),
});

const MAX_TOKENS_PER_SESSION = Number(process.env.MAX_TOKENS_PER_SESSION ?? "20000");
const MAX_USER_TURNS = Number(process.env.MAX_USER_TURNS ?? "15");

export async function POST(req: Request) {
  const p = await loadParticipant();
  if (!p || !p.consent_given || !p.demographics) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Control condition participants have no assistant — any call here is either
  // a bug or a tampering attempt. Fail loudly so we don't silently log
  // assistant messages for a no-AI participant.
  if (p.condition === "control") {
    return NextResponse.json(
      { error: "assistant not available for this participant" },
      { status: 403 },
    );
  }
  const sessionId = await loadSessionId();
  if (!sessionId) return NextResponse.json({ error: "no session" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "invalid body" }, { status: 400 });

  // Load full history
  const { data: history, error: hErr } = await db()
    .from("messages")
    .select("role, content, token_count")
    .eq("session_id", sessionId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true });

  if (hErr) return NextResponse.json({ error: hErr.message }, { status: 500 });

  const soFar = (history ?? []).reduce(
    (n, m) => n + (m.token_count ?? approxTokens(m.content)),
    0,
  );
  if (soFar > MAX_TOKENS_PER_SESSION) {
    return NextResponse.json(
      { error: "session token budget exceeded" },
      { status: 429 },
    );
  }

  const userCount = (history ?? []).filter((m) => m.role === "user").length;
  if (userCount >= MAX_USER_TURNS) {
    return NextResponse.json(
      { error: `message limit reached (${MAX_USER_TURNS}). You can still submit your career plan.` },
      { status: 429 },
    );
  }

  const userContent = parsed.data.content;
  const userTokens = approxTokens(userContent);

  // Persist user message first so history is always consistent, even if stream fails.
  const { error: insErr } = await db().from("messages").insert({
    session_id: sessionId,
    role: "user",
    content: userContent,
    token_count: userTokens,
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Bump the denormalized per-session user turn counter so analysis / exports
  // can read it directly from `sessions` without joining `messages`.
  await db()
    .from("sessions")
    .update({ user_turn_count: userCount + 1 })
    .eq("id", sessionId);

  const chatHistory = [
    ...((history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content as string,
    }))),
    { role: "user" as const, content: userContent },
  ];

  const fullMessages = buildMessages(p.condition, chatHistory);

  let result;
  try {
    result = await streamChat(fullMessages, sessionId);
  } catch (err) {
    console.error("Groq stream failed:", err);
    return NextResponse.json(
      { error: "assistant unavailable — please try again" },
      { status: 503 },
    );
  }

  const { stream, done } = result;
  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (err) {
        console.error("stream error:", err);
        try { controller.close(); } catch {}
      }
      // After stream closes, persist the assistant message.
      try {
        const final = await done;
        await db().from("messages").insert({
          session_id: sessionId,
          role: "assistant",
          content: final.content,
          token_count: final.completionTokens ?? approxTokens(final.content),
        });
      } catch (err) {
        console.error("failed to persist assistant message:", err);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
