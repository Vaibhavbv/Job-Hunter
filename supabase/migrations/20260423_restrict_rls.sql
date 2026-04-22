-- ============================================================
-- Security & RLS Overhaul Migration
-- Apply strict user-based Row Level Security
-- ============================================================

-- Drop the insecure public policies for user_sessions
drop policy if exists "Public read sessions" on user_sessions;
drop policy if exists "Public insert sessions" on user_sessions;

-- Add strict auth policies for user_sessions
create policy "Users read own sessions" on user_sessions for select using (auth.uid() = user_id);
create policy "Users insert own sessions" on user_sessions for insert with check (auth.uid() = user_id);
create policy "Users update own sessions" on user_sessions for update using (auth.uid() = user_id);
create policy "Users delete own sessions" on user_sessions for delete using (auth.uid() = user_id);

-- Drop the insecure public policies for ai_jobs
drop policy if exists "Public read ai_jobs" on ai_jobs;
drop policy if exists "Public insert ai_jobs" on ai_jobs;
drop policy if exists "Public update ai_jobs" on ai_jobs;

-- Add strict auth policies for ai_jobs
-- It verifies identity by joining traversing the user_sessions table
create policy "Users read own ai_jobs" on ai_jobs for select using (
  exists (
    select 1 from user_sessions
    where user_sessions.id = ai_jobs.session_id
    and user_sessions.user_id = auth.uid()
  )
);

create policy "Users insert own ai_jobs" on ai_jobs for insert with check (
  exists (
    select 1 from user_sessions
    where user_sessions.id = ai_jobs.session_id
    and user_sessions.user_id = auth.uid()
  )
);

create policy "Users update own ai_jobs" on ai_jobs for update using (
  exists (
    select 1 from user_sessions
    where user_sessions.id = ai_jobs.session_id
    and user_sessions.user_id = auth.uid()
  )
);

create policy "Users delete own ai_jobs" on ai_jobs for delete using (
  exists (
    select 1 from user_sessions
    where user_sessions.id = ai_jobs.session_id
    and user_sessions.user_id = auth.uid()
  )
);

-- Drop public policies on usage_log and restrict
drop policy if exists "Public read usage_log" on usage_log;
drop policy if exists "Public insert usage_log" on usage_log;

create policy "Users read own usage_log" on usage_log for select using (
  exists (
    select 1 from user_sessions
    where user_sessions.id = usage_log.session_id
    and user_sessions.user_id = auth.uid()
  )
);

create policy "Users insert own usage_log" on usage_log for insert with check (
  exists (
    select 1 from user_sessions
    where user_sessions.id = usage_log.session_id
    and user_sessions.user_id = auth.uid()
  )
);
