// Researcher utility: dump everything we have on a single participant in a
// human-readable form so you can inspect a row without writing SQL.
//
// Shows three sections:
//   1. PRE-SURVEY      — participant assignment metadata + demographics (the
//                        intake form answers).
//   2. WRITING         — the submitted career plan, word count, time-on-task.
//   3. POST-SURVEY     — the post-task survey payload.
//
// Usage (from study-app/):
//   npm run inspect -- <participant-uuid>
//
// The npm script forwards the UUID to this file and loads .env.local so the
// Supabase service-role key is available without manual export.

import { createClient } from "@supabase/supabase-js";

const HR = "─".repeat(72);

function die(msg, code = 1) {
  console.error(`error: ${msg}`);
  process.exit(code);
}

function header(title) {
  console.log(`\n${HR}\n${title}\n${HR}`);
}

function field(label, value) {
  if (value === null || value === undefined || value === "") {
    console.log(`${label}: (none)`);
  } else if (typeof value === "object") {
    console.log(`${label}:`);
    console.log(JSON.stringify(value, null, 2));
  } else {
    console.log(`${label}: ${value}`);
  }
}

function isUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    s,
  );
}

const uuid = process.argv[2];
if (!uuid) {
  die(
    "missing participant UUID.\nusage: npm run inspect -- <participant-uuid>",
  );
}
if (!isUuid(uuid)) {
  die(`'${uuid}' doesn't look like a UUID.`);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  die(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. Run via\n" +
      "  npm run inspect -- <uuid>\n" +
      "(the npm script loads .env.local for you), or export them yourself.",
  );
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: participant, error: pErr } = await supabase
  .from("participants")
  .select("*")
  .eq("id", uuid)
  .maybeSingle();

if (pErr) die(`Supabase error reading participant: ${pErr.message}`);
if (!participant) die(`no participant found with id ${uuid}`);

// PRE-SURVEY ----------------------------------------------------------------
header("PRE-SURVEY  (assignment + intake demographics)");
field("Participant ID  ", participant.id);
field("Created at      ", participant.created_at);
field("Condition       ", participant.condition);
field("Biography ID    ", participant.biography_id);
field("Prompt version  ", participant.prompt_version);
field("Consent given   ", participant.consent_given);
field("Task started at ", participant.task_started_at);
field("Debriefed       ", participant.debriefed);
field("Demographics    ", participant.demographics);

// WRITING SUBMISSION --------------------------------------------------------
const { data: submissions, error: sErr } = await supabase
  .from("submissions")
  .select("*")
  .eq("participant_id", uuid)
  .order("submitted_at", { ascending: false });

if (sErr) die(`Supabase error reading submissions: ${sErr.message}`);

header("WRITING SUBMISSION");
if (!submissions || submissions.length === 0) {
  console.log("(no submission yet)");
} else {
  // Normally exactly one submission per participant. If there are duplicates
  // (rare; would mean a bug elsewhere) we show the latest first and note the
  // count.
  if (submissions.length > 1) {
    console.log(`(found ${submissions.length} submissions — showing latest first)\n`);
  }
  submissions.forEach((sub, idx) => {
    if (idx > 0) console.log("\n--- earlier submission ---");
    field("Submitted at    ", sub.submitted_at);
    field("Word count      ", sub.word_count);
    field("Duration (sec)  ", sub.duration_seconds);
    console.log("\nCareer plan:");
    console.log(sub.final_text);
  });
}

// POST-SURVEY ---------------------------------------------------------------
const { data: postRows, error: psErr } = await supabase
  .from("survey_responses")
  .select("*")
  .eq("participant_id", uuid)
  .eq("kind", "post")
  .order("created_at", { ascending: false });

if (psErr) die(`Supabase error reading post-survey: ${psErr.message}`);

header("POST-SURVEY");
if (!postRows || postRows.length === 0) {
  console.log("(no post-survey response yet)");
} else {
  if (postRows.length > 1) {
    console.log(`(found ${postRows.length} post-survey rows — showing latest first)\n`);
  }
  postRows.forEach((row, idx) => {
    if (idx > 0) console.log("\n--- earlier response ---");
    field("Recorded at     ", row.created_at);
    field("Payload         ", row.payload);
  });
}

console.log(`\n${HR}\nDone.\n`);
