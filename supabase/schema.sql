-- Biased-LLM Writing Study — Supabase schema
-- Run this in Supabase SQL Editor after creating a new project.

create extension if not exists "pgcrypto";

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  condition text not null check (condition in ('biased','neutral','control')),
  biography_id text not null,
  prompt_version text not null default 'v1',
  consent_given boolean not null default false,
  demographics jsonb,
  debriefed boolean not null default false
);

-- v3.1: widen the condition CHECK to include 'control' for the no-AI group.
-- Idempotent for existing deployments (drop + re-add with the new list).
alter table participants drop constraint if exists participants_condition_check;
alter table participants add constraint participants_condition_check
  check (condition in ('biased','neutral','control'));

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'chatting' check (status in ('chatting','submitted','abandoned')),
  user_turn_count int not null default 0
);

-- Idempotent for existing deployments (schema predates user_turn_count).
alter table sessions add column if not exists user_turn_count int not null default 0;

create index if not exists sessions_participant_id_idx on sessions(participant_id);

create table if not exists messages (
  id bigserial primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  token_count int,
  created_at timestamptz not null default now()
);

create index if not exists messages_session_id_idx on messages(session_id, created_at);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  final_text text not null,
  word_count int not null,
  submitted_at timestamptz not null default now()
);

create index if not exists submissions_participant_id_idx on submissions(participant_id);

create table if not exists survey_responses (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  kind text not null check (kind in ('pre','post')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists groq_calls (
  id bigserial primary key,
  session_id uuid references sessions(id) on delete set null,
  key_index smallint,
  status_code int,
  retry_count smallint default 0,
  prompt_tokens int,
  completion_tokens int,
  latency_ms int,
  error text,
  created_at timestamptz not null default now()
);

-- v5: time-on-task tracking.
-- `task_started_at` is set the first time a participant lands on /task; the
-- submit endpoint computes seconds-elapsed at submission time and writes it
-- to `submissions.duration_seconds`. Both columns nullable so they're
-- backfill-safe for any pre-v5 rows.
alter table participants add column if not exists task_started_at timestamptz;
alter table submissions add column if not exists duration_seconds int;

-- Row-level security: tables are accessed only via service-role key in API routes,
-- so we enable RLS with no policies (default deny) to block anon/authenticated access.
alter table participants enable row level security;
alter table sessions enable row level security;
alter table messages enable row level security;
alter table submissions enable row level security;
alter table survey_responses enable row level security;
alter table groq_calls enable row level security;
