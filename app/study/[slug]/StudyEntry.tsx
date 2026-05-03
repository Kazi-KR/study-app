"use client";

import { useEffect, useRef, useState } from "react";

const TAB_MARKER_KEY = "study_tab";

type HandshakeResponse = {
  participantId: string;
  redirectTo: string;
};

// Per-tab session handshake. On mount:
//   0. If a `?bioId=…` query param is present, strip it from the address bar
//      via `history.replaceState` immediately so the participant never sees
//      it — the bio selection is researcher-side metadata.
//   1. If sessionStorage has `study_tab`, POST /api/study/resume — server reads
//      the auth cookie and returns where the participant left off. If the
//      cookie is gone (404) we fall through to start. `bioId` is irrelevant on
//      resume because the participant already has a biography assigned.
//   2. Otherwise (fresh tab, or fallback from step 1), POST /api/study/start
//      with the bioId (if any) — server creates a new participants + sessions
//      row honoring the override (or falling back to balanced rotation when
//      bioId is omitted), sets cookies, returns the new participant id. Write
//      the id into sessionStorage so a refresh inside this tab resumes
//      correctly.
//   3. Either way, navigate to the returned `redirectTo` via
//      `window.location.replace` so the entry URL doesn't sit in the back
//      stack.
//
// React StrictMode in dev mounts effects twice — guard with a ref so we don't
// fire the handshake twice and accidentally create two participants.
export default function StudyEntry({
  slug,
  bioId,
}: {
  slug: string;
  bioId?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    // Hide the bioId param from the address bar before anything else runs.
    if (window.location.search) {
      window.history.replaceState(null, "", `/study/${slug}`);
    }

    // When a researcher passes `?bioId=…` they explicitly want a fresh
    // participant assigned to that biography. Drop any leftover tab marker so
    // the resume path is skipped and the start path runs. Real participants'
    // distributed links normally don't carry bioId, so this doesn't affect
    // them.
    if (bioId) {
      sessionStorage.removeItem(TAB_MARKER_KEY);
    }

    let cancelled = false;

    async function handshake() {
      const marker = sessionStorage.getItem(TAB_MARKER_KEY);

      if (marker) {
        const res = await fetch("/api/study/resume", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug }),
        });
        if (res.ok) {
          const body = (await res.json()) as HandshakeResponse;
          if (cancelled) return;
          window.location.replace(body.redirectTo);
          return;
        }
        // Cookie gone or stale — drop the marker and fall through to start.
        sessionStorage.removeItem(TAB_MARKER_KEY);
      }

      const res = await fetch("/api/study/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, bioId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        setError(body?.error ?? `Failed to start study (HTTP ${res.status})`);
        return;
      }
      const body = (await res.json()) as HandshakeResponse;
      sessionStorage.setItem(TAB_MARKER_KEY, body.participantId);
      if (cancelled) return;
      window.location.replace(body.redirectTo);
    }

    handshake().catch((e: unknown) => {
      if (cancelled) return;
      setError(e instanceof Error ? e.message : "Unexpected error");
    });

    return () => {
      cancelled = true;
    };
  }, [slug, bioId]);

  return (
    <main className="mx-auto max-w-md px-6 py-20 text-center">
      {error ? (
        <>
          <h1 className="text-lg font-semibold mb-2">
            We couldn&apos;t start the study
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {error}
          </p>
        </>
      ) : (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Loading…
        </p>
      )}
    </main>
  );
}
