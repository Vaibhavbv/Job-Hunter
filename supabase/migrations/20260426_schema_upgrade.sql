-- ============================================================
-- Phase 2: Schema Upgrade Migration
-- 
-- Creates:  evaluations, resumes, scan_history
-- Enhances: profiles (preferences + base resume), jobs (metadata)
-- 
-- Run in Supabase SQL Editor after all previous migrations.
-- ============================================================

-- =====================
-- 1. EVALUATIONS TABLE
-- 5-dimension AI scoring per user×job
-- =====================

create table if not exists evaluations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  job_id          bigint not null references jobs(id) on delete cascade,
  session_id      uuid references user_sessions(id) on delete set null,

  -- 5 scoring dimensions (0-100)
  technical_fit   smallint check (technical_fit between 0 and 100),
  seniority_fit   smallint check (seniority_fit between 0 and 100),
  domain_fit      smallint check (domain_fit between 0 and 100),
  salary_fit      smallint check (salary_fit between 0 and 100),
  location_fit    smallint check (location_fit between 0 and 100),

  -- Computed / AI fields
  overall_score   smallint check (overall_score between 0 and 100),
  grade           text,            -- A+, A, B+, B, C, D, F
  archetype       text,            -- 'Dream Job', 'Strong Match', 'Stretch', 'Safety', 'Mismatch'
  gate_fail       text,            -- null = pass, else the dimension name that failed
  recommendation  text,            -- 'Apply Now', 'Worth Trying', 'Maybe Later', 'Skip'
  reasons         jsonb default '[]',
  risks           jsonb default '[]',
  summary         text,

  -- Metadata
  model_used      text default 'gemini-2.5-flash',
  evaluated_at    timestamptz default now(),

  -- One evaluation per user per job
  unique(user_id, job_id)
);

create index if not exists idx_evaluations_user on evaluations(user_id);
create index if not exists idx_evaluations_job on evaluations(job_id);
create index if not exists idx_evaluations_score on evaluations(user_id, overall_score desc);
create index if not exists idx_evaluations_grade on evaluations(user_id, grade);

-- =====================
-- 2. RESUMES TABLE
-- Stores tailored resume versions
-- =====================

create table if not exists resumes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  job_id          bigint references jobs(id) on delete set null,
  session_id      uuid references user_sessions(id) on delete set null,

  original_text   text not null,
  tailored_text   text not null,
  keywords_added  jsonb default '[]',
  ats_score       smallint check (ats_score between 0 and 100),
  version         integer not null default 1,

  created_at      timestamptz default now()
);

create index if not exists idx_resumes_user on resumes(user_id);
create index if not exists idx_resumes_user_job on resumes(user_id, job_id);

-- =====================
-- 3. SCAN_HISTORY TABLE
-- Tracks scraping runs for deduplication
-- =====================

create table if not exists scan_history (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,  -- null for cron runs
  apify_run_id    text unique,
  actor_id        text,
  platform        text,
  status          text not null default 'running',  -- running, completed, failed
  jobs_found      integer default 0,
  jobs_inserted   integer default 0,
  jobs_deduplicated integer default 0,
  filter_snapshot jsonb,
  error_message   text,
  started_at      timestamptz default now(),
  completed_at    timestamptz
);

create index if not exists idx_scan_history_user on scan_history(user_id);
create index if not exists idx_scan_history_run on scan_history(apify_run_id);
create index if not exists idx_scan_history_status on scan_history(status);

-- =====================
-- 4. PROFILES TABLE ENHANCEMENTS
-- Add preferences and base resume
-- =====================

alter table profiles add column if not exists headline text;
alter table profiles add column if not exists base_resume text;
alter table profiles add column if not exists skills jsonb default '[]';
alter table profiles add column if not exists preferred_roles jsonb default '[]';
alter table profiles add column if not exists min_salary integer;
alter table profiles add column if not exists preferred_locations jsonb default '[]';
alter table profiles add column if not exists experience_years integer;
alter table profiles add column if not exists bio text;

-- =====================
-- 5. JOBS TABLE ENHANCEMENTS
-- Ghost detection, status, experience
-- =====================

alter table jobs add column if not exists is_duplicate boolean default false;
alter table jobs add column if not exists is_ghost boolean default false;
alter table jobs add column if not exists status text default 'active';
alter table jobs add column if not exists apify_run_id text;
alter table jobs add column if not exists experience text;
alter table jobs add column if not exists company_size text;
alter table jobs add column if not exists scraped_at timestamptz default now();

create index if not exists idx_jobs_status on jobs(status);
create index if not exists idx_jobs_ghost on jobs(is_ghost) where is_ghost = true;

-- =====================
-- 6. RLS POLICIES
-- =====================

-- --- evaluations ---
alter table evaluations enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'evaluations' and policyname = 'Users read own evaluations') then
    execute 'create policy "Users read own evaluations" on evaluations for select using (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'evaluations' and policyname = 'Users insert own evaluations') then
    execute 'create policy "Users insert own evaluations" on evaluations for insert with check (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'evaluations' and policyname = 'Users update own evaluations') then
    execute 'create policy "Users update own evaluations" on evaluations for update using (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'evaluations' and policyname = 'Users delete own evaluations') then
    execute 'create policy "Users delete own evaluations" on evaluations for delete using (auth.uid() = user_id)';
  end if;
end
$$;

-- --- resumes ---
alter table resumes enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'resumes' and policyname = 'Users read own resumes') then
    execute 'create policy "Users read own resumes" on resumes for select using (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'resumes' and policyname = 'Users insert own resumes') then
    execute 'create policy "Users insert own resumes" on resumes for insert with check (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'resumes' and policyname = 'Users update own resumes') then
    execute 'create policy "Users update own resumes" on resumes for update using (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'resumes' and policyname = 'Users delete own resumes') then
    execute 'create policy "Users delete own resumes" on resumes for delete using (auth.uid() = user_id)';
  end if;
end
$$;

-- --- scan_history ---
-- Users can read their own scans; service role handles inserts from webhooks/cron
alter table scan_history enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'scan_history' and policyname = 'Users read own scans') then
    execute 'create policy "Users read own scans" on scan_history for select using (auth.uid() = user_id)';
  end if;
  -- Service role (webhooks, cron) bypasses RLS for inserts/updates.
  -- No insert/update policy for regular users — they don't create scan runs directly.
end
$$;

-- =====================
-- 7. HELPER: Auto-sync base_resume from latest session
-- When a user parses a new resume, copy it to profiles.base_resume
-- =====================

create or replace function public.sync_base_resume()
returns trigger as $$
begin
  if new.user_id is not null then
    update profiles
    set base_resume = new.resume_text,
        updated_at = now()
    where id = new.user_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_session_created on user_sessions;
create trigger on_session_created
  after insert on user_sessions
  for each row execute function public.sync_base_resume();
