import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadParticipant } from "@/lib/session";

// Serves Hunspell aff/dic for nspell. The files live in node_modules/dictionary-en.
// We read them via fs rather than importing the ESM package so we don't have to
// fight Next.js / Turbopack bundling of a Node-only module.
//
// The route is gated to authenticated participants so we don't serve ~1 MB to
// anyone who finds the URL. It's also cached hard: the dictionary is immutable
// for the life of a deploy.

export const runtime = "nodejs";

let cached: { aff: string; dic: string } | null = null;

async function loadDict(): Promise<{ aff: string; dic: string }> {
  if (cached) return cached;
  const base = resolve(process.cwd(), "node_modules/dictionary-en");
  const [aff, dic] = await Promise.all([
    readFile(resolve(base, "index.aff"), "utf-8"),
    readFile(resolve(base, "index.dic"), "utf-8"),
  ]);
  cached = { aff, dic };
  return cached;
}

export async function GET() {
  const p = await loadParticipant();
  if (!p) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dict = await loadDict();
  return NextResponse.json(dict, {
    headers: {
      // Immutable for the life of the deploy; the browser can hold on to it.
      "cache-control": "private, max-age=86400, immutable",
    },
  });
}
