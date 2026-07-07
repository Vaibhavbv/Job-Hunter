-- ============================================================
-- Billing & Entitlements Migration (Roadmap Phase A, step 1)
--
-- Creates:  plans, credit_packs, subscriptions, credit_ledger,
--           payment_events, credit_balances (view)
-- Enhances: profiles (plan column)
--
-- This migration is purely additive and inert: nothing is
-- enforced until the Razorpay edge functions and the metering
-- guards land (Phase A steps 2-3). Metering of free-tier caps
-- needs no counter table — usage is counted from existing rows
-- (evaluations.evaluated_at / resumes.created_at in the current
-- calendar month), minus credit-paid actions recorded in
-- credit_ledger.
--
-- Run in Supabase SQL Editor after all previous migrations.
-- ============================================================

-- =====================
-- 1. PLANS CATALOG
-- Public pricing catalog. Prices in whole INR (not paise) —
-- checkout converts to paise for Razorpay.
-- null limit = unlimited (fair-use enforced in the edge guard).
-- =====================

create table if not exists plans (
  id                text primary key,          -- 'free', 'pro_monthly', 'pro_yearly'
  name              text not null,
  price_inr         integer not null check (price_inr >= 0),
  billing_interval  text not null check (billing_interval in ('none', 'month', 'year')),
  monthly_evals     integer,                   -- null = unlimited
  monthly_rewrites  integer,                   -- null = unlimited
  features          jsonb not null default '{}',
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

insert into plans (id, name, price_inr, billing_interval, monthly_evals, monthly_rewrites, features)
values
  ('free',        'Free',       0,    'none',  10,   1,
   '{"alerts": false, "priority_scraping": false, "export": false}'),
  ('pro_monthly', 'Pro',        399,  'month', null, 100,
   '{"alerts": true, "priority_scraping": true, "export": true}'),
  ('pro_yearly',  'Pro Annual', 2999, 'year',  null, 100,
   '{"alerts": true, "priority_scraping": true, "export": true}')
on conflict (id) do nothing;

-- =====================
-- 2. CREDIT PACKS CATALOG
-- One-time top-ups. 1 credit = 1 evaluation; 3 credits = 1 resume rewrite
-- (the exchange rate lives in the metering guard, not the schema).
-- =====================

create table if not exists credit_packs (
  id          text primary key,                -- 'pack_50', 'pack_175', 'pack_400'
  name        text not null,
  price_inr   integer not null check (price_inr > 0),
  credits     integer not null check (credits > 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into credit_packs (id, name, price_inr, credits)
values
  ('pack_50',  'Starter — 50 credits',  99,  50),
  ('pack_175', 'Plus — 175 credits',    299, 175),
  ('pack_400', 'Power — 400 credits',   599, 400)
on conflict (id) do nothing;

-- =====================
-- 3. SUBSCRIPTIONS
-- v1 model: prepaid periods (a Razorpay Order per period), not
-- auto-recurring mandates — renewal is a fresh payment. The
-- razorpay_subscription_id column is reserved for a later move
-- to Razorpay Subscriptions.
-- Written only by the service role (razorpay-webhook).
-- =====================

create table if not exists subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users(id) on delete cascade,
  plan_id                   text not null references plans(id),
  status                    text not null default 'created'
                            check (status in ('created', 'trialing', 'active', 'past_due', 'canceled', 'expired')),
  razorpay_order_id         text,
  razorpay_payment_id       text,
  razorpay_subscription_id  text unique,
  current_period_start      timestamptz,
  current_period_end        timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists idx_subscriptions_user on subscriptions(user_id);
-- At most one live subscription per user
create unique index if not exists idx_subscriptions_one_live
  on subscriptions(user_id) where status in ('trialing', 'active');

-- =====================
-- 4. CREDIT LEDGER
-- Append-only. Balance = sum(delta). Positive deltas: purchases,
-- referrals, admin grants. Negative deltas: metered AI actions.
-- Written only by the service role (webhook + metering guards).
-- =====================

create table if not exists credit_ledger (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  delta       integer not null check (delta <> 0),
  reason      text not null,   -- 'purchase', 'referral', 'eval', 'resume_rewrite', 'admin_adjust'
  ref         text,            -- razorpay payment id / evaluation id / etc.
  created_at  timestamptz not null default now()
);

create index if not exists idx_credit_ledger_user on credit_ledger(user_id, created_at desc);

-- Balance view. security_invoker so the caller's RLS on
-- credit_ledger applies: users see only their own balance.
create or replace view credit_balances
  with (security_invoker = true) as
  select user_id, coalesce(sum(delta), 0)::integer as balance
  from credit_ledger
  group by user_id;

-- =====================
-- 5. PAYMENT EVENTS
-- Webhook idempotency log, keyed by Razorpay's x-razorpay-event-id.
-- The webhook inserts before processing; a conflict means the
-- event was already handled and must be skipped.
-- Service-role only — no user policies.
-- =====================

create table if not exists payment_events (
  id            text primary key,   -- razorpay event id
  event_type    text not null,
  payload       jsonb not null,
  processed_at  timestamptz not null default now()
);

-- =====================
-- 6. PROFILES: current plan
-- Denormalized pointer maintained by the webhook (and downgraded
-- by the entitlement guard when a period lapses).
-- =====================

alter table profiles add column if not exists plan text not null default 'free' references plans(id);

-- =====================
-- 7. RLS
-- =====================

alter table plans          enable row level security;
alter table credit_packs   enable row level security;
alter table subscriptions  enable row level security;
alter table credit_ledger  enable row level security;
alter table payment_events enable row level security;

do $$
begin
  -- Catalogs are public (pricing page renders pre-auth). Writes: service role only.
  if not exists (select 1 from pg_policies where tablename = 'plans' and policyname = 'Anyone reads active plans') then
    execute 'create policy "Anyone reads active plans" on plans for select using (is_active)';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'credit_packs' and policyname = 'Anyone reads active packs') then
    execute 'create policy "Anyone reads active packs" on credit_packs for select using (is_active)';
  end if;

  -- Users read their own billing state. All writes go through the
  -- service role (razorpay-webhook / metering guards), so there are
  -- deliberately no insert/update/delete policies.
  if not exists (select 1 from pg_policies where tablename = 'subscriptions' and policyname = 'Users read own subscriptions') then
    execute 'create policy "Users read own subscriptions" on subscriptions for select using (auth.uid() = user_id)';
  end if;
  if not exists (select 1 from pg_policies where tablename = 'credit_ledger' and policyname = 'Users read own ledger') then
    execute 'create policy "Users read own ledger" on credit_ledger for select using (auth.uid() = user_id)';
  end if;

  -- payment_events: no user policies — service role only.
end
$$;

-- =====================
-- 8. updated_at maintenance for subscriptions
-- =====================

create or replace function public.touch_subscriptions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_subscription_updated on subscriptions;
create trigger on_subscription_updated
  before update on subscriptions
  for each row execute function public.touch_subscriptions_updated_at();
