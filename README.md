# Biased-LLM Writing Study

Next.js + Groq + Supabase app for an MS thesis at the HCI × NLP intersection. Participants read a short biography, chat with a Llama-3 70B writing assistant, and submit a 200–300 word career plan. The assistant's system prompt is swapped between a **neutral** and **biased** condition based on the URL slug the participant used to enter. Data is persisted in Postgres for downstream linguistic analysis.

## Setup

### 1. Supabase

1. Create a free project at https://supabase.com.
2. In the SQL editor, run the contents of `supabase/schema.sql`.
3. Copy the **Project URL** and the **service_role** key from Project Settings → API.

### 2. Groq

Create 5 API keys at https://console.groq.com/keys (one is fine for local dev — the code falls back to `GROQ_API_KEY`).

### 3. Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY_1` … `GROQ_API_KEY_5`
- `STUDY_SLUG_A` (control — no AI), `STUDY_SLUG_B` (neutral AI), `STUDY_SLUG_C` (biased AI) — pick opaque short slugs
- `EXPORT_TOKEN` — a long random string for `/api/export`

### 4. Install and run

```bash
npm install
npm run dev
```

Visit `http://localhost:3000/study/<STUDY_SLUG_A>`, `/study/<STUDY_SLUG_B>`, or `/study/<STUDY_SLUG_C>` to begin as a participant (control — no AI / neutral AI / biased AI respectively).

## Flow

1. `/study/[slug]` → creates a participant row, picks a biography balanced within condition, sets a cookie, redirects to `/consent`.
2. `/consent` → plain-language consent.
3. `/intake` → demographics (age, gender, university, year, field, AI familiarity Likerts).
4. `/task` → biography at the top (full width), then a two-column layout: career-plan editor on the left, writing assistant on the right, with matching heights. Submit enables after `MIN_USER_TURNS` chat turns and a 200–300-word plan. A hard cap of `MAX_USER_TURNS` (default 15) messages per session is enforced in both the UI and the API; hitting the cap only disables the chat input — participants can still submit their career plan. For the **control** condition there is no assistant: only the biography and the career-plan editor are shown, and the chat-turn gate is skipped.
5. `/post` → post-task Likert survey + free-text.
6. `/end` → a plain thank-you page. Full debriefing (the bias manipulation reveal + both system prompts) is sent to participants by email after the study closes, not shown in-app.

## API routes

Participant-facing routes carry opaque suffixes so DevTools inspection doesn't leak the flow. Update the suffix in both the route path and the caller if you rotate them:

| Route | Used by |
|---|---|
| `POST /api/intake/b6fy5c` | `app/intake/IntakeForm.tsx` |
| `POST /api/chat/k7wn3x`   | `app/task/TaskClient.tsx` (chat streaming) |
| `POST /api/submit/p9vqm2` | `app/task/TaskClient.tsx` (career plan) |
| `POST /api/survey/t4nz8r` | `app/post/PostSurvey.tsx` |
| `POST /api/preview-chat`  | researcher-only `/preview` tool (admin-token gated) |
| `GET  /api/export`        | admin export (token-gated) |

## Distributing links to participants

Split the cohort across three links: `https://<app>/study/<STUDY_SLUG_A>` (control — no AI), `/study/<STUDY_SLUG_B>` (neutral AI), and `/study/<STUDY_SLUG_C>` (biased AI). Assignment is effectively done by you at distribution time; the app does not randomize. Slug→condition mapping is server-only (`lib/conditions.ts`) so the participant can't tell from the URL.

### Pinning a biography per participant

By default the app picks one of the eight biographies via balanced rotation (counts existing participants in the same condition and chooses the least-used). To override this and assign a specific biography for a given link, append `?bioId=<id>`:

```
https://<app>/study/<STUDY_SLUG_B>?bioId=bio2_f
```

Valid ids: `bio1_m`, `bio1_f`, `bio2_m`, `bio2_f`, `bio3_m`, `bio3_f`, `bio4_m`, `bio4_f`. An unknown id 404s on entry. The query string is stripped from the address bar before the participant ever sees the rest of the flow, and is never displayed in the UI. Manually-assigned participants still count toward the rotation, so the picker self-corrects for unrotated visitors.

## Exporting data

```
curl "https://<app>/api/export?token=<EXPORT_TOKEN>&table=messages" > messages.csv
curl "https://<app>/api/export?token=<EXPORT_TOKEN>&table=participants" > participants.csv
curl "https://<app>/api/export?token=<EXPORT_TOKEN>&table=submissions" > submissions.csv
curl "https://<app>/api/export?token=<EXPORT_TOKEN>&table=survey_responses" > survey.csv
curl "https://<app>/api/export?token=<EXPORT_TOKEN>&table=groq_calls" > groq.csv
```

## Deploying to Vercel

1. Push this folder to a GitHub repository.
2. Import the repo in https://vercel.com/new.
3. Add every variable from `.env.local` to the Vercel project's Environment Variables.
4. Deploy.

Vercel's free tier is sufficient for a thesis cohort.

## Architecture notes

- **Stateless LLM**: every Groq call gets the full conversation. `app/api/chat/k7wn3x/route.ts` loads history from Postgres, prepends only the condition-specific persona as the system prompt (v3 — the biography text and task instructions are no longer injected), and streams the response to the browser while persisting the final message. The `sessions.user_turn_count` column is bumped on every user message so analysis can read it directly without aggregating `messages`.
- **Key rotation**: `lib/groq.ts` picks from 5 keys in random round-robin order, cooling down any key that returns 429/503 for 30 seconds, retrying up to 3 times per call. Every attempt is logged to `groq_calls`.
- **Context window**: Llama-3.3 70B has a 128K context; the safety rail is `MAX_TOKENS_PER_SESSION` (default 20K). Typical sessions are <5K tokens.
- **Bias manipulation**: `lib/prompts.ts` holds `BIASED_PROMPT` and `NEUTRAL_PROMPT`. They are never sent to the client — only to Groq from the server.
- **Biographies**: four, paired by gender; `lib/biographies.ts` picks the least-assigned one within the participant's condition so each cell fills evenly.
