# Job Hunter — Build Roadmap

> Execution plan for turning Job Hunter into a sellable product. Strategy and rationale live in
> **[PRODUCT_STRATEGY.md](./PRODUCT_STRATEGY.md)**; this doc is the *how* and *in what order*.
> Effort estimates are rough (S = ~1–2 days, M = ~3–5 days, L = ~1–2 weeks) for a single
> developer. Each phase has explicit acceptance criteria and a primary metric.

---

## Guardrails (apply to every phase)

- **Don't rewrite the engine.** The per-user AI layer and shared scraper work — build the
  storefront and cash register *around* them.
- **Validate AI unit cost first** (Phase A) before promising "unlimited" anything.
- Every new table gets `auth.uid()` RLS from the start (follow the pattern in
  `supabase/migrations/20260426_schema_upgrade.sql`).
- Verify end-to-end after each phase: real payment in Razorpay **test mode**, real gate hit in
  the UI, real metering decrement in the DB — not just typecheck/build.

---

## Phase A — Monetization spine  *(effort: L)*

**Goal:** a user can pay, and access is gated by what they paid for.

### Data model (new migration, e.g. `supabase/migrations/2026XXXX_billing.sql`)
- `plans` — plan catalog (`free`, `pro_monthly`, `pro_yearly`, `pro_plus`): price, interval,
  entitlement JSON (monthly eval/rewrite limits, feature flags).
- `subscriptions` — `user_id`, `plan_id`, `status` (trialing/active/past_due/canceled),
  `razorpay_subscription_id`, `current_period_end`. RLS: user reads own.
- `credit_ledger` — append-only: `user_id`, `delta` (+ on purchase/referral, − on spend),
  `reason`, `ref` (order id / eval id), `created_at`. Balance = `sum(delta)`. RLS: user reads own.
- `profiles.plan` (text, default `'free'`) + `profiles.credits_balance` (maintained cache or a
  view over the ledger).
- Replace the misleading Apify-budget `check-credits` with a real **per-user balance** endpoint.

### Backend (edge functions, Deno — mirror existing function style)
- `razorpay-checkout` — creates a Razorpay order/subscription for a chosen plan or credit pack.
- `razorpay-webhook` — verifies signature, on `payment.captured` / `subscription.charged`
  writes the `subscription` row or a `credit_ledger` credit. **Signature verification is
  mandatory.**
- `meter-ai-action` (or inline guard in `evaluate-jobs` / `rewrite-resume`) — before running a
  Gemini action: check plan entitlement or credit balance, reject if exhausted, decrement on
  success. This is the paywall's teeth.

### Frontend (`frontend/src`)
- `hooks/useEntitlements.ts` — current plan, remaining evals/rewrites, credit balance.
- Gate the AI trigger points (`useEvaluations.ts` `evaluate`, the resume-tailor call in
  `services/api.ts`) behind entitlement checks; show an upgrade/credit modal on exhaustion.
- A billing/plan section (extend `pages/Settings.tsx`) + a Razorpay checkout flow.

**Acceptance:** in Razorpay test mode, a user can (1) buy Pro and get unlimited evals, (2) buy a
credit pack and see the balance rise, (3) be blocked with an upgrade prompt when a free user
exhausts their 10 evals. **Metric:** first ₹ processable.

---

## Phase B — Conversion funnel  *(effort: L)*

**Goal:** a stranger can discover the product, sign up, hit the "aha," and see the paywall.

- **Public routes** in `App.tsx` (currently everything except `/auth` is behind
  `ProtectedRoute`): add public `/` landing, `/pricing`, and `/tools/resume-score`.
- **Landing page** — the Copilot headline, how-it-works, social proof, pricing teaser, CTAs.
  (The `ui-ux-pro-max` skill in `.claude/skills` is available for the visual build.)
- **Pricing page** — the Free/Credits/Pro table from PRODUCT_STRATEGY §4, ₹ pricing, trial CTA.
- **Free "Resume ATS Score" tool** — ungated: paste/upload resume → Gemini ATS score + top-3
  fixes → sign-up wall to apply the fixes. Reuses `parse-resume` + `rewrite-resume`. This is the
  top-of-funnel growth engine.
- **Onboarding** — post-signup: profile + resume → first graded matches → first free tailored
  resume (the aha) → natural paywall.
- **SEO** — real `<title>`/meta/OG tags per route (SPA needs prerender or SSR meta), a `sitemap.xml`,
  and the *scaffold* for programmatic job/role pages (full programmatic SEO can be a follow-up).

**Acceptance:** an incognito visitor lands on `/`, uses the free ATS tool, signs up, completes
onboarding to a first tailored resume, and sees the paywall — with no dead ends. **Metric:**
free-tool → signup rate; activation rate.

---

## Phase C — Retention & growth loops  *(effort: M)*

**Goal:** users come back without us paying to re-acquire them.

- **Email alerts + weekly digest** — daily "new A+ matches for you" (Pro) and a weekly digest
  (Free). Supabase scheduled function or extend the GitHub Actions cron; template off each user's
  `evaluations`.
- **WhatsApp alerts** (Pro) — daily A+ matches via a WhatsApp Business API provider. India-native
  retention channel.
- **Referrals** — both-sided credit grants written to `credit_ledger`; a shareable invite link.
- **Shareable resume score** — public OG image of a user's ATS score to fuel the viral loop.

**Acceptance:** a Pro user receives a real daily alert containing their actual top matches; a
referral credits both accounts. **Metric:** WAU/MAU; referral-driven signups; alert CTR.

---

## Phase D — Trust & ops  *(effort: M)*

**Goal:** safe to scale and to hold users' resume PII.

- **Legal** — ToS, Privacy Policy, refund policy. **India DPDP Act**: explicit consent for resume
  storage, data-export + data-deletion flows, minimal retention.
- **Monitoring** — Sentry (frontend + edge functions), PostHog/Plausible for product analytics
  and funnel instrumentation.
- **Hardening** — tighten edge-function **CORS from `*`** to the known origins (carried over from
  the earlier backend-hardening backlog), rate-limit AI endpoints, email-verification gate before
  AI actions, abuse/velocity checks on the free tier.
- **Reliability** — alert on empty/failed scraper runs via `scan_history`; degrade gracefully if
  an Apify actor breaks so grades never silently go stale.

**Acceptance:** a user can export and delete their data; errors page to Sentry; AI endpoints
reject abusive volume; CORS is origin-locked. **Metric:** error rate; abuse incidents; compliance
readiness.

---

## Phase E — Expansion  *(effort: L+, post-PMF)*

**Goal:** raise ARPU and open new segments once the core loop converts and retains.

- **Interview prep** — AI mock interviews / Q-bank per role (new Gemini flows).
- **Coaching / human review** — Pro+ tier with human-in-the-loop resume review, referrals
  marketplace.
- **B2B / campus** — seats/white-label for placement cells and bootcamps (the secondary ICP).
- **Programmatic SEO at scale** — full generation of role×city and company landing pages.

**Acceptance & metric:** defined when Phase A–D metrics prove PMF; gated on retention + LTV:CAC.

---

## Tracked tech debt (address opportunistically, not blocking)

- **Legacy `ai_jobs` / `user_sessions` (IP-based) flow overlaps the per-user `evaluations`
  flow.** Two ways to "match jobs" is confusing and duplicates cost. Reconcile onto the
  `evaluations` path and retire the legacy session-based tables/policies
  (`supabase/migrations/20260401000000_ai_schema.sql`, `20260423_restrict_rls.sql`).
- **`check-credits` is misnamed/misleading** — it reports the shared Apify account budget, not a
  user's balance. Replaced by the real per-user balance endpoint in Phase A; remove the old one.
- **AI Dashboard `description`-never-fetched gap** and **`salary_match` / `experience_match`
  having no real data source** (carried from the earlier review) — clean up as part of Phase A/C
  when touching the AI flows.
- **JS→TS migration** is effectively complete for the app; keep new files typed.

---

## How the phases map to the strategy

| Strategy goal (PRODUCT_STRATEGY.md) | Phase |
|---|---|
| Charge money (§4 monetization) | A |
| Acquire users (§6 growth, §2 wedge) | B |
| Retain users (§6 loops, §7 retention KPIs) | C |
| Scale safely (§9 risks) | D |
| Grow ARPU (§4 Pro+, expansion) | E |
