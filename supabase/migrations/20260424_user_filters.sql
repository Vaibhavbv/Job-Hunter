-- ============================================================
-- User Filters Schema
-- Allow users to define scraping preferences
-- ============================================================

create table if not exists user_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role_type text not null,
  location text default 'Remote',
  platform_preference text default 'All', -- All, LinkedIn, Naukri, Indeed
  is_active boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_user_filters_user on user_filters(user_id);

alter table user_filters enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'user_filters' and policyname = 'Users read own filters') then
    execute 'create policy "Users read own filters" on user_filters for select using (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'user_filters' and policyname = 'Users insert own filters') then
    execute 'create policy "Users insert own filters" on user_filters for insert with check (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'user_filters' and policyname = 'Users update own filters') then
    execute 'create policy "Users update own filters" on user_filters for update using (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'user_filters' and policyname = 'Users delete own filters') then
    execute 'create policy "Users delete own filters" on user_filters for delete using (auth.uid() = user_id)';
  end if;
end
$$;
