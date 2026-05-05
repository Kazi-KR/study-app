"use client";

import { useFormStatus } from "react-dom";

// Submit button rendered as a child of the form so React's `useFormStatus`
// can report `pending` while the server action is in flight. Without this
// the button just sat there for a couple of seconds (server action + redirect
// + next-page render) and the participant got no feedback. Now it
// immediately shows "Submitting…" and disables, so the wait feels intentional.
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="rounded-md bg-black px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-black"
    >
      {pending ? "Submitting…" : "I agree to participate in this study"}
    </button>
  );
}

export default function ConsentForm({
  action,
}: {
  action: (fd: FormData) => void;
}) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold mb-4">Consent to Participate</h1>
      <div className="prose prose-neutral text-sm leading-6 mb-6 dark:prose-invert">
        <p>
          You are invited to take part in a research study to explore how students think about and write a career vision plan for a peer in different environments. This study is being
          conducted as part of a Master&rsquo;s thesis under the supervision of
          Dr. S. M. Taiabul Haque and is approved under his Institutional
          Review Board (IRB) oversight.
        </p>

        <h2 className="text-base font-semibold mt-6 mb-2">What You Will Do</h2>
        <p>Participants will be asked to complete the following tasks:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Read a short biography of a recent university graduate</li>
          <li>
            Prepare a written career plan (at least 200 words) for that
            individual
          </li>
          <li>
            Depending on the assigned study condition, the task may be
            completed either independently or with the support of an AI-based
            writing assistant
          </li>
          <li>Complete a brief post-task survey</li>
        </ul>

        <h2 className="text-base font-semibold mt-6 mb-2">Duration</h2>
        <p>
          The entire session is expected to take approximately 30&ndash;45
          minutes.
        </p>

        <h2 className="text-base font-semibold mt-6 mb-2">Compensation</h2>
        <p>You will receive 2 bonus marks for completing the study. If you choose not to participate, you may
          complete an alternative assignment to receive an equivalent 2 bonus
          marks, ensuring that your decision will not affect your academic
          standing.
        </p>

        <h2 className="text-base font-semibold mt-6 mb-2">
          Data Collection and Privacy
        </h2>
        <p>We will collect:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Anonymous demographic information</li>
          <li>The full conversation you have with the AI assistant</li>
          <li>Your final written response</li>
          <li>Post survey responses</li>
        </ul>
        <p>
          No directly identifying information (such as name or email) will be
          collected. All data will be stored securely and used only for
          research purposes. 
        </p>

        <h2 className="text-base font-semibold mt-6 mb-2">
          Voluntary Participation
        </h2>
        <p>
          Your participation is completely voluntary. You may withdraw at any
          time by closing the browser tab. If you withdraw, any partial data
          will not be used in the study.
        </p>

        <h2 className="text-base font-semibold mt-6 mb-2">Consent Statement</h2>
        <p>By proceeding with the study, you confirm that:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>You have read and understood the information above</li>
          <li>You voluntarily agree to participate</li>
          <li>You are aware of your right to withdraw at any time</li>
        </ul>
      </div>

      {/*
        Single affirmative-action button: clicking it IS the consent. The
        hidden `consent` input keeps the existing server action's check
        (`formData.get("consent") === "on"`) working without modification.
      */}
      <form action={action}>
        <input type="hidden" name="consent" value="on" />
        <SubmitButton />
      </form>
    </main>
  );
}
