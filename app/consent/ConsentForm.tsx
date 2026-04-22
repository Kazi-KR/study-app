"use client";

import { useState } from "react";

export default function ConsentForm({
  action,
}: {
  action: (fd: FormData) => void;
}) {
  const [agreed, setAgreed] = useState(false);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold mb-4">Consent to Participate</h1>
      <div className="prose prose-neutral text-sm leading-6 mb-6 dark:prose-invert">
        <p>
          You are invited to take part in a research study about how people
          write with the help of AI writing assistants. The study is part of a
          Master's thesis in Human–Computer Interaction.
        </p>
        <p>
          <strong>What you will do.</strong> You will read a short biography of a
          recent university graduate, have a short conversation with an AI
          assistant about career planning, and then write a 200–300 word career
          plan for that graduate. Afterwards, you will answer a short survey.
          The session takes approximately 15–25 minutes.
        </p>
        <p>
          <strong>Data we collect.</strong> Your anonymous demographic answers,
          the full conversation you have with the assistant, and your final
          written text. No directly identifying information (name, email) is
          collected. Data is stored securely and will only be reported in
          aggregate form.
        </p>
        <p>
          <strong>Voluntariness.</strong> Participation is voluntary. You may
          close the browser tab at any time and your partial data will not be
          used.
        </p>
      </div>
      <form action={action} className="space-y-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="consent"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1"
          />
          <span>
            I am 18 years or older, I have read the information above, and I
            agree to participate.
          </span>
        </label>
        <button
          type="submit"
          disabled={!agreed}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          Continue
        </button>
      </form>
    </main>
  );
}
