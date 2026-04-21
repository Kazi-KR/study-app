import { NextResponse } from "next/server";
import { z } from "zod";
import { buildMessages, streamChat } from "@/lib/groq";
import { biographyById } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  biography_id: z.string().min(1),
  condition: z.enum(["biased", "neutral"]),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(100),
});

export async function POST(req: Request) {
  const expected = process.env.EXPORT_TOKEN;
  const provided = req.headers.get("x-admin-token");
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const { biography_id, condition, messages } = parsed.data;
  if (!biographyById(biography_id)) {
    return NextResponse.json({ error: "unknown biography" }, { status: 400 });
  }

  // biography_id is still validated (so the preview UI's dropdown is sound),
  // but in v3 the assistant only sees its persona + the chat history — the
  // biography text is not injected into the system prompt.
  const fullMessages = buildMessages(condition, messages);

  let result;
  try {
    result = await streamChat(fullMessages, null);
  } catch (err) {
    console.error("preview streamChat failed:", err);
    return NextResponse.json(
      { error: "assistant unavailable" },
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
      } catch (err) {
        console.error("preview stream error:", err);
      } finally {
        try { controller.close(); } catch {}
      }
      try { await done; } catch {}
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
