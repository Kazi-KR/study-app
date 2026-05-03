import "server-only";
import { cookies } from "next/headers";

// Researcher dashboard auth: a session cookie holding the EXPORT_TOKEN value.
// Set by the form action in TokenGate.tsx; read by every analytics page
// before rendering. We re-use EXPORT_TOKEN (already used by /api/export and
// /api/preview-chat) so there's exactly one secret to manage.
export const ADMIN_COOKIE = "study_admin";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  // Session cookie: dies when the browser closes. The researcher pastes the
  // token once per session.
};

export async function isAdmin(): Promise<boolean> {
  const expected = process.env.EXPORT_TOKEN;
  if (!expected) return false;
  const c = await cookies();
  const got = c.get(ADMIN_COOKIE)?.value;
  return got === expected;
}

export async function setAdminCookie(token: string): Promise<void> {
  const c = await cookies();
  c.set(ADMIN_COOKIE, token, COOKIE_OPTS);
}

export async function clearAdminCookie(): Promise<void> {
  const c = await cookies();
  c.delete(ADMIN_COOKIE);
}
