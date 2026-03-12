-- ============================================================
-- Supabase Schema for Job Dashboard
-- Run this once in Supabase SQL Editor
-- ============================================================

create table if not exists jobs (
  id           bigserial primary key,
  title        text not null,
  company      text not null,
  location     text,
  url          text,
  platform     text,           -- LinkedIn / Naukri / Indeed
  role_type    text,           -- e.g. Data Engineer, Data Analyst
  salary       text,
  description  text,
  posted_date  date,
  dedup_key    text unique,    -- normalized title|company key for deduplication
  created_at   timestamptz default now()
);

-- Indexes for fast dashboard queries
create index if not exists idx_jobs_posted_date on jobs(posted_date desc);
create index if not exists idx_jobs_role_type   on jobs(role_type);
create index if not exists idx_jobs_platform    on jobs(platform);

-- Enable Row Level Security and allow public reads
alter table jobs enable row level security;

-- Drop the policy first if it exists (safe for re-runs)
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'jobs' and policyname = 'Public read'
  ) then
    execute 'create policy "Public read" on jobs for select using (true)';
  end if;
end
$$;
