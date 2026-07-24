# Auto-Apply Agent — Design Document

**Status:** Proposal / Design
**Scope requested:** Full auto-apply (LinkedIn, Naukri, Indeed + company ATS) with the agent submitting applications on the user's behalf.
**Author:** Design draft for review before implementation.

---

## 1. Goal

Extend Job Hunter from *"scrape → evaluate → track"* to *"scrape → evaluate → **apply** → track"*.

Today the pipeline stops at a recommendation (`evaluations.recommendation = 'Apply Now'`) and a manually-updated `application_tracker` row. This design adds an **apply layer** that takes an evaluated job and drives an actual application to completion, then writes the result back into the existing tracker.

The user has explicitly asked for the **full-autonomy** version (auto-submit on the aggregators, not just company ATS). This document scopes that honestly — including the parts that will not work reliably and why — and proposes an architecture that degrades gracefully from "fully automatic" to "one-click assisted" per platform, because **no single approach works across all four targets.**

---

## 2. Reality check (read this before building)

Full auto-apply is not one problem; it is four different problems with very different risk profiles. The design below reflects that. Summarizing the constraints up front so the phased plan makes sense:

| Target | Auto-submit feasible? | Primary blocker | Realistic posture |
|---|---|---|---|
| **Company ATS** (Greenhouse, Lever, Ashby, Workable) | ✅ Yes | Field mapping variety | **Full auto** (Phase 2) |
| **LinkedIn Easy Apply** | ⚠️ Partial | ToS ban + bot detection + multi-step modals + screening Qs | **Auto-fill, human-confirm** (Phase 3) |
| **Indeed Apply** | ⚠️ Partial | ToS + CAPTCHA + Indeed-hosted flow | **Auto-fill, human-confirm** (Phase 3) |
| **Naukri** | ⚠️ Partial | ToS + OTP/login friction | **Auto-fill, human-confirm** (Phase 3) |
| **External/company-site "Apply" links** | ✅/⚠️ Varies | Unknown form each time | **Best-effort auto + fallback** (Phase 2/4) |

### Hard constraints that shape the architecture

1. **Terms of Service.** LinkedIn, Indeed, and Naukri all prohibit automated submission and actively detect it (device fingerprinting, behavioral analysis, CAPTCHA challenges). Applying requires acting **as the logged-in user** — exactly the activity these platforms ban. The current scraper avoids this by using **Apify actors** (third-party scraping infra) rather than the user's own credentials. *Applying cannot be delegated to Apify the same way* — it needs the user's session. This is the single biggest reason full auto-apply on the aggregators is fragile and account-risky.

2. **CAPTCHA / anti-bot.** The aggregators throw interactive challenges precisely on the apply action. These cannot be reliably solved headlessly without third-party CAPTCHA services (added cost, still detectable, and arguably escalates the ToS problem).

3. **Screening questions are unbounded.** "Are you authorized to work in India?", "Expected CTC?", "Notice period?", "Rate your Python 1–10", "Why do you want to work here?" — some are answerable from profile data, some are free-text and role-specific. A submit-blind agent will answer these wrong and get filtered out. Quality collapses exactly when volume goes up.

4. **Outcome quality.** Recruiters actively filter mass-applied candidates. The value of this project's A+–F grading is *selectivity*; auto-blasting undermines the very signal that makes the pipeline useful. The design therefore keeps a **grade/recommendation gate** in front of the apply queue by default.

### The design's answer to these constraints

- **Human-in-the-loop is the default, not full-blind auto.** The agent does 100% of the *work* (tailoring, form-filling, answer drafting) and requests a one-click confirmation on platforms where blind submit is unsafe or ToS-hostile. A per-user "auto-submit" toggle exists (Section 8) for the platforms where it's viable (company ATS), and is available-but-off-by-default and clearly risk-labeled for the aggregators.
- **A single apply abstraction** with per-platform drivers, so "confirm-first" vs "full-auto" is a config knob, not a rewrite.
- **Everything is logged** into the existing tracker + a new audit table, so the user always has a record of what was submitted and can stop the agent instantly.

---

## 3. High-level architecture

The apply layer mirrors the existing scraper's **orchestrator + webhook + Edge Function** split, and reuses the existing `rewrite-resume` / profile / evaluation machinery.

```
                          ┌─────────────────────────────────────┐
                          │  Frontend: "Apply Queue" page (new)  │
                          │  - review drafts, approve/edit/skip  │
                          │  - per-platform auto-submit toggles  │
                          │  - live status + kill switch         │
                          └───────────────┬─────────────────────┘
                                          │ (user approves N jobs)
                                          ▼
        ┌──────────────────────────────────────────────────────────────┐
        │  Edge Function: prepare-application   (Deno, Gemini)          │
        │  - pulls job + evaluation + profile + base_resume            │
        │  - calls rewrite-resume (tailored resume)                    │
        │  - generates cover letter                                    │
        │  - pre-answers known screening questions from profile        │
        │  - writes an `applications` row (status = 'draft')           │
        └───────────────┬──────────────────────────────────────────────┘
                        │ approved drafts -> queue
                        ▼
        ┌──────────────────────────────────────────────────────────────┐
        │  Apply Worker  (Python + Playwright, GitHub Actions or a      │
        │                 small always-on host)                         │
        │  - claims 'queued' applications                               │
        │  - routes to a per-platform Driver                            │
        │  - drives the browser: fill fields, upload resume, answer Qs  │
        │  - AUTO-SUBMIT (ATS)  or  PAUSE-FOR-CONFIRM (aggregators)     │
        │  - screenshots each step, writes audit trail                  │
        │  - updates `applications.status` + `application_tracker`      │
        └───────────────┬──────────────────────────────────────────────┘
                        │ per-platform
          ┌─────────────┼───────────────┬───────────────┬──────────────┐
          ▼             ▼               ▼               ▼              ▼
      ATSDriver   LinkedInDriver   IndeedDriver   NaukriDriver   GenericDriver
     (Greenhouse/  (Easy Apply,    (Indeed Apply, (login+OTP,    (best-effort
      Lever/Ashby) confirm-first)  confirm-first) confirm-first) heuristics)
```

### Why a separate Python/Playwright worker (not an Edge Function)?

Supabase Edge Functions are Deno, short-lived, and cannot drive a real browser or hold a logged-in session. Actual form submission needs:
- a **headful/headless real browser** (Playwright — already available in the dev environment: Chromium at `/opt/pw-browsers/chromium`),
- **persistent per-platform login sessions** (stored cookies / storage state),
- **longer runtimes** than an Edge Function allows.

So the split is: **Edge Functions do the AI + data work** (stateless, fast, already the pattern here); a **Playwright worker does the browser driving** (stateful, long-running). The worker reuses the same Supabase REST + service-role auth pattern the existing `scraper.py` already uses.

---

## 4. Data model (new migration)

New migration file: `supabase/migrations/20260501_auto_apply.sql`. Follows the existing conventions exactly (UUID PKs, `user_id` FK to `auth.users`, per-table RLS with idempotent `do $$ ... $$` policy guards, indexes on `user_id`).

### 4.1 `applications` — one row per (user, job) application attempt

```sql
create table if not exists applications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  job_id            bigint not null references jobs(id) on delete cascade,
  evaluation_id     uuid references evaluations(id) on delete set null,
  resume_id         uuid references resumes(id) on delete set null,   -- tailored resume used

  platform          text,           -- LinkedIn / Naukri / Indeed / ATS:Greenhouse / ...
  apply_method      text,           -- 'ats_auto' | 'confirm_first' | 'assisted_manual'
  status            text not null default 'draft',
    -- draft -> queued -> in_progress -> awaiting_confirm -> submitted
    --       -> failed | skipped | needs_captcha | needs_login
  cover_letter      text,
  answers           jsonb default '{}',   -- {question: answer} for screening Qs
  external_ref       text,                 -- confirmation id / URL if the platform gives one
  error_message     text,
  attempts          smallint default 0,
  submitted_at      timestamptz,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),

  unique(user_id, job_id)             -- never apply to the same job twice
);

create index if not exists idx_applications_user   on applications(user_id);
create index if not exists idx_applications_status on applications(user_id, status);
create index if not exists idx_applications_queue  on applications(status) where status = 'queued';
```

### 4.2 `application_events` — append-only audit trail (screenshots, step log)

```sql
create table if not exists application_events (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references applications(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  event_type      text not null,     -- 'field_filled','captcha_hit','submitted','error','screenshot'
  detail          jsonb default '{}',
  screenshot_path text,              -- Supabase Storage path
  created_at      timestamptz default now()
);
create index if not exists idx_app_events_app on application_events(application_id, created_at);
```

### 4.3 `apply_credentials` — encrypted per-platform session/login material

Storing login sessions is the sensitive part. **Do not store raw passwords in Postgres.** Options, preferred first:

1. **Storage-state cookies only** (Playwright `storageState`), captured once via an interactive login the user performs themselves, encrypted at rest. Sessions expire → user re-links. This avoids ever holding the password.
2. Secrets in **Supabase Vault** (`pgsodium`) rather than a plain table.

```sql
create table if not exists apply_credentials (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  platform        text not null,          -- LinkedIn / Naukri / Indeed
  storage_state   text,                   -- ENCRYPTED Playwright storageState JSON
  status          text default 'active',  -- active | expired | revoked
  last_verified   timestamptz,
  created_at      timestamptz default now(),
  unique(user_id, platform)
);
alter table apply_credentials enable row level security;
-- RLS: user reads own; only service role (worker) decrypts. Never expose storage_state to the anon client.
```

### 4.4 `profiles` additions (application answer bank)

The agent needs canonical answers to standard screening questions. Extend `profiles`:

```sql
alter table profiles add column if not exists phone            text;
alter table profiles add column if not exists current_ctc      integer;
alter table profiles add column if not exists expected_ctc     integer;
alter table profiles add column if not exists notice_period    text;    -- e.g. '30 days'
alter table profiles add column if not exists work_authorized  boolean; -- authorized in target country
alter table profiles add column if not exists linkedin_url     text;
alter table profiles add column if not exists portfolio_url    text;
alter table profiles add column if not exists answer_bank      jsonb default '{}';
  -- freeform {normalized_question: preferred_answer} the agent learns/reuses
```

All new tables get the same four-policy RLS block (`select`/`insert`/`update`/`delete` `using (auth.uid() = user_id)`) already used by `application_tracker`, `evaluations`, `resumes`, etc.

---

## 5. Component detail

### 5.1 Edge Function: `prepare-application`

**Input:** `{ user_id, job_id }` (called from the frontend when the user queues a job, or in batch for all `recommendation = 'Apply Now'` jobs).

**Steps:**
1. Load `jobs`, `evaluations`, `profiles`, `profiles.base_resume`.
2. Call the existing **`rewrite-resume`** function to produce a job-tailored resume → `resumes` row. (Reuse, don't reinvent.)
3. Generate a **cover letter** via Gemini (same client/secret pattern as `evaluate-jobs`/`rewrite-resume`).
4. **Pre-answer screening questions:** map profile fields → the standard question set (work authorization, notice period, CTC, relocation, years of experience). Unknown/free-text questions are left blank and flagged for the user.
5. Insert an `applications` row with `status = 'draft'`, the tailored `resume_id`, `cover_letter`, and `answers`.

This function is **pure AI + data** — no browser — so it fits the existing Edge Function model cleanly and stays inside the current Gemini budget/credit accounting (`usage_log`, `check-credits`).

### 5.2 Apply Worker (Python + Playwright)

Mirrors `scraper.py`'s structure: env-configured, service-role Supabase REST access, one clear `main()` loop. Pseudocode:

```python
def main():
    apps = claim_queued_applications(limit=BATCH)      # status queued -> in_progress
    for app in apps:
        driver = DRIVERS[route(app["platform"])]        # ATS / LinkedIn / Indeed / Naukri / Generic
        try:
            ctx = load_browser_context(app["user_id"], app["platform"])  # storageState
            result = driver.apply(ctx, app)             # fills form, uploads resume, answers Qs
            if driver.auto_submit_allowed(app):
                result = driver.submit(ctx, app)
                update_status(app, "submitted", external_ref=result.ref)
                upsert_tracker(app, status="Applied")   # feed existing application_tracker
            else:
                update_status(app, "awaiting_confirm")   # user presses "Submit" in the UI
        except CaptchaError:
            update_status(app, "needs_captcha")          # surface to user, never auto-solve
        except LoginError:
            update_status(app, "needs_login")            # prompt user to re-link session
        except Exception as e:
            record_error(app, e); update_status(app, "failed")
        finally:
            save_screenshots(app)                        # audit trail -> application_events
```

**Driver contract** (each platform implements):
```python
class ApplyDriver(Protocol):
    def apply(self, ctx, app) -> StepResult: ...        # fill everything up to the submit button
    def submit(self, ctx, app) -> SubmitResult: ...     # click final submit
    def auto_submit_allowed(self, app) -> bool: ...     # policy: ATS=True, aggregators=user-toggle
```

**Where the worker runs:**
- **Company ATS (Phase 2):** GitHub Actions on-demand `workflow_dispatch` is fine (short, no persistent login).
- **Aggregators (Phase 3):** need a persistent logged-in browser session; better on a small always-on host (a cheap VM / container) than in ephemeral CI. GitHub Actions can still trigger it, but the browser session/state lives on the host or in encrypted `apply_credentials`.

### 5.3 Per-platform drivers

- **ATSDriver** — detects the ATS by URL/DOM (Greenhouse, Lever, Ashby, Workable have stable, well-known form structures), maps profile → fields, uploads the tailored resume PDF, answers standard Qs, submits. **This is the one that genuinely supports full auto** and delivers most of the real value.
- **LinkedInDriver** — handles the Easy Apply modal's multi-step flow. Auto-fills, but defaults to `awaiting_confirm` (ToS + detection risk). Auto-submit is a per-user opt-in that the UI labels as risky.
- **IndeedDriver / NaukriDriver** — same posture: auto-fill, human-confirm; handle login/OTP by pausing to `needs_login`.
- **GenericDriver** — for "external apply" links to unknown company sites: heuristic label→field matching, best-effort fill, always confirm-first.

---

## 6. Frontend: the Apply Queue page

New page `frontend/src/pages/ApplyQueue.tsx` (+ `useApplications.ts` hook, following the existing `useTracker.ts` / `useEvaluations.ts` pattern and `services/api.ts` client).

- **Draft cards:** each shows the job, the tailored resume (diff vs base), the generated cover letter, and the pre-filled answers — all **editable** before queueing.
- **Bulk action:** "Prepare applications for all *Apply Now* jobs."
- **Per-platform auto-submit toggles** in Settings, off by default, with an explicit risk note for the aggregators.
- **Live status column** driven by `applications.status`, including `awaiting_confirm` cards with a one-click **Submit** and `needs_captcha` / `needs_login` cards that link the user to finish the step.
- **Kill switch:** "Pause all applying" flips queued rows back to `draft` and the worker stops claiming.
- **History:** submitted applications with screenshots from `application_events`, and they flow into the existing **Tracker** and **Analytics** funnel automatically.

---

## 7. Guardrails (non-negotiable defaults)

1. **Grade gate:** only `recommendation IN ('Apply Now','Worth Trying')` are eligible to queue by default (user-adjustable). No blind blasting of F-grade jobs.
2. **Daily cap:** per-user max applications/day (default e.g. 15) to stay human-plausible and protect accounts.
3. **Dedupe:** `unique(user_id, job_id)` guarantees the agent never double-applies.
4. **Confirm-first by default on every aggregator.** Auto-submit is opt-in, per-platform, risk-labeled.
5. **Full audit trail:** every field fill + screenshot logged; the user can see exactly what was submitted.
6. **Kill switch + pause** always available.
7. **No CAPTCHA auto-solving.** Hitting a CAPTCHA pauses and asks the user.
8. **Credential minimization:** prefer cookie/storage-state capture over storing passwords; encrypt at rest; never expose to the anon client.

---

## 8. Configuration surface

Per-user settings (stored on `profiles` / a small `apply_settings` JSON):
- `auto_submit_ats` (default **on** — low risk)
- `auto_submit_linkedin` / `_indeed` / `_naukri` (default **off**, risk-labeled)
- `daily_cap`
- `min_recommendation` gate
- answer bank (CTC, notice period, work authorization, etc.)

New Edge Function secrets: none beyond existing `GEMINI_API_KEY`. Worker host needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and an **encryption key** for `storage_state`.

---

## 9. Phased implementation plan

| Phase | Deliverable | Risk | Value |
|---|---|---|---|
| **1 — Draft engine** | `20260501_auto_apply.sql` migration, `prepare-application` Edge Function, Apply Queue UI with editable drafts + tailored resume + cover letter + pre-answered screening Qs. **No auto-submit yet** — user copies/clicks into the real form. | 🟢 None | 🟢 High — kills the repetitive typing, always-tailored materials |
| **2 — ATS auto-submit** | Playwright worker + `ATSDriver` for Greenhouse/Lever/Ashby/Workable, full auto-submit, audit screenshots, tracker write-back. | 🟡 Low | 🟢 High — real end-to-end applies where it's safe |
| **3 — Aggregator auto-fill** | LinkedIn/Indeed/Naukri drivers, session linking (`apply_credentials`), **confirm-first** submit, CAPTCHA/login pause states. | 🔴 High (ToS/ban) | 🟡 Medium |
| **4 — Aggregator auto-submit (opt-in)** | Flip the per-platform toggle to allow blind submit for users who accept the risk; add pacing/jitter. | 🔴 High | 🟡 Low–Medium |

**Recommendation:** build Phase 1 and Phase 2 for sure — that's where almost all the safe value is. Treat Phase 3 as experimental and Phase 4 as an explicit, risk-acknowledged opt-in rather than the default, even though full auto is the stated goal. The architecture supports all four; only the per-platform `auto_submit_*` toggle changes.

---

## 10. Open questions for the user

1. **Account risk tolerance:** are you OK risking a LinkedIn/Naukri restriction on *your* account for Phase 3/4? (This is the real cost of "full auto everywhere.")
2. **Worker hosting:** do you have a small always-on host for the persistent-session worker, or should Phase 2 stay GitHub-Actions-only (ATS) until then?
3. **Cover letter tone / language**, and any hard "never apply to" rules (companies, locations, salary floor already in profile).
4. **Answer bank:** fill in CTC / notice period / work authorization now so Phase 1 drafts are complete on day one.

---

*This is a design proposal. No application-submitting code is included in this doc — Phase 1 is the safe starting point and can be implemented on request.*
