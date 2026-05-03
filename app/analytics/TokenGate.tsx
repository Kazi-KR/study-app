import { redirect } from "next/navigation";
import { setAdminCookie } from "./auth";

// Login form for the analytics dashboard. Researcher pastes the EXPORT_TOKEN
// value; the server action validates it and sets the `study_admin` cookie.
// On success we redirect back to the same path so the page re-renders with
// access. On failure we redirect with `?error=1` so the form can show a
// minimal error message without exposing whether the env var is unset vs the
// token is wrong.
export default function TokenGate({
  redirectTo,
  error,
}: {
  redirectTo: string;
  error?: boolean;
}) {
  async function login(formData: FormData) {
    "use server";
    const token = String(formData.get("token") ?? "");
    const expected = process.env.EXPORT_TOKEN;
    if (!expected || token !== expected) {
      redirect(`${redirectTo}?error=1`);
    }
    await setAdminCookie(token);
    redirect(redirectTo);
  }

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="text-xl font-semibold mb-2">Analytics</h1>
      <p className="text-sm text-neutral-600 mb-6 dark:text-neutral-400">
        This dashboard is for researchers only. Paste the admin token to
        continue.
      </p>
      <form action={login} className="space-y-3">
        <input
          type="password"
          name="token"
          autoFocus
          required
          placeholder="EXPORT_TOKEN value"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400">
            Invalid token.
          </div>
        )}
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
