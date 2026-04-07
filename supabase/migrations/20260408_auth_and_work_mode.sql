-- ============================================================
-- Auth + Work Mode Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add work_mode column to jobs table
alter table jobs add column if not exists work_mode text;

-- 2. Create profiles table linked to auth.users
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 3. Add user_id to user_sessions (nullable for backward compatibility)
alter table user_sessions add column if not exists user_id uuid references auth.users(id) on delete set null;

-- 4. Indexes
create index if not exists idx_jobs_work_mode on jobs(work_mode);
create index if not exists idx_user_sessions_user on user_sessions(user_id);

-- 5. RLS for profiles
alter table profiles enable row level security;

do $$
begin
  -- Profiles: users can read/update their own profile
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Users read own profile') then
    execute 'create policy "Users read own profile" on profiles for select using (auth.uid() = id)';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Users update own profile') then
    execute 'create policy "Users update own profile" on profiles for update using (auth.uid() = id)';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'Users insert own profile') then
    execute 'create policy "Users insert own profile" on profiles for insert with check (auth.uid() = id)';
  end if;
end
$$;

-- 6. Auto-create profile on signup via trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists, then create
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7. Backfill work_mode from location/description for existing jobs
update jobs
set work_mode = case
  when lower(coalesce(location, '') || ' ' || coalesce(description, '')) like '%remote%' then 'Remote'
  when lower(coalesce(location, '') || ' ' || coalesce(description, '')) like '%hybrid%' then 'Hybrid'
  when lower(coalesce(location, '') || ' ' || coalesce(description, '')) like '%work from home%' then 'Remote'
  when lower(coalesce(location, '') || ' ' || coalesce(description, '')) like '%wfh%' then 'Remote'
  when lower(coalesce(location, '') || ' ' || coalesce(description, '')) like '%on-site%' then 'On-site'
  when lower(coalesce(location, '') || ' ' || coalesce(description, '')) like '%onsite%' then 'On-site'
  when lower(coalesce(location, '') || ' ' || coalesce(description, '')) like '%in-office%' then 'On-site'
  else null
end
where work_mode is null;
