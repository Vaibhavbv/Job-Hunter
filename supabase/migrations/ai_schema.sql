-- ============================================================
-- AI Job Matching Schema
-- Run this in Supabase SQL Editor after the base schema
-- ============================================================

-- Stores resume text + extracted job titles per session
create table if not exists user_sessions (
  id            uuid primary key default gen_random_uuid(),
  resume_text   text not null,
  job_titles    jsonb not null default '[]',
  ip_address    text,
  created_at    timestamptz default now()
);

-- Stores AI-matched jobs linked to a session
create table if not exists ai_jobs (
  id               bigserial primary key,
  session_id       uuid references user_sessions(id) on delete cascade,
  title            text not null,
  company          text not null,
  location         text,
  salary           text,
  experience       text,
  jd_text          text,
  relevancy_score  integer,
  salary_match     text,
  experience_match boolean,
  reasons          jsonb,
  summary          text,
  portal_url       text,
  fetched_at       timestamptz default now()
);

-- Rate limiting / caching table
create table if not exists usage_log (
  id          bigserial primary key,
  session_id  uuid references user_sessions(id),
  ip_address  text not null,
  fetched_at  timestamptz default now()
);

-- Indexes
create index if not exists idx_ai_jobs_session on ai_jobs(session_id);
create index if not exists idx_ai_jobs_score on ai_jobs(relevancy_score desc);
create index if not exists idx_usage_log_ip on usage_log(ip_address, fetched_at desc);

-- RLS
alter table user_sessions enable row level security;
alter table ai_jobs enable row level security;
alter table usage_log enable row level security;

do $$
begin
  -- user_sessions policies
  if not exists (select 1 from pg_policies where tablename = 'user_sessions' and policyname = 'Public read sessions') then
    execute 'create policy "Public read sessions" on user_sessions for select using (true)';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'user_sessions' and policyname = 'Public insert sessions') then
    execute 'create policy "Public insert sessions" on user_sessions for insert with check (true)';
  end if;

  -- ai_jobs policies
  if not exists (select 1 from pg_policies where tablename = 'ai_jobs' and policyname = 'Public read ai_jobs') then
    execute 'create policy "Public read ai_jobs" on ai_jobs for select using (true)';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'ai_jobs' and policyname = 'Public insert ai_jobs') then
    execute 'create policy "Public insert ai_jobs" on ai_jobs for insert with check (true)';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'ai_jobs' and policyname = 'Public update ai_jobs') then
    execute 'create policy "Public update ai_jobs" on ai_jobs for update using (true)';
  end if;

  -- usage_log policies
  if not exists (select 1 from pg_policies where tablename = 'usage_log' and policyname = 'Public read usage_log') then
    execute 'create policy "Public read usage_log" on usage_log for select using (true)';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'usage_log' and policyname = 'Public insert usage_log') then
    execute 'create policy "Public insert usage_log" on usage_log for insert with check (true)';
  end if;
end
$$;
