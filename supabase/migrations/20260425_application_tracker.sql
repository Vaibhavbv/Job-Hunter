-- ============================================================
-- Application Tracker + Usage Log User ID Migration
-- Creates the missing application_tracker table and adds
-- user_id column to usage_log for user-based rate limiting.
-- ============================================================

-- 1. Create application_tracker table
create table if not exists application_tracker (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  job_id bigint references jobs(id) on delete set null,
  title text,
  company text,
  status text not null default 'Applied',
  notes text,
  applied_date timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_app_tracker_user on application_tracker(user_id);
create index if not exists idx_app_tracker_status on application_tracker(user_id, status);

alter table application_tracker enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'application_tracker' and policyname = 'Users read own applications') then
    execute 'create policy "Users read own applications" on application_tracker for select using (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'application_tracker' and policyname = 'Users insert own applications') then
    execute 'create policy "Users insert own applications" on application_tracker for insert with check (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'application_tracker' and policyname = 'Users update own applications') then
    execute 'create policy "Users update own applications" on application_tracker for update using (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'application_tracker' and policyname = 'Users delete own applications') then
    execute 'create policy "Users delete own applications" on application_tracker for delete using (auth.uid() = user_id)';
  end if;
end
$$;

-- 2. Add user_id column to usage_log for user-based rate limiting
alter table usage_log add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists idx_usage_log_user on usage_log(user_id, fetched_at desc);
