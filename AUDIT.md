# Job Hunter — Full Codebase Audit

> **Auditor**: AI Systems Architect  
> **Date**: 2026-04-22  
> **Scope**: Every file in the repository — frontend, backend, scraper, schema, CI/CD  

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [File-by-File Audit](#2-file-by-file-audit)
3. [Dead Code & Unused Dependencies](#3-dead-code--unused-dependencies)
4. [Security Vulnerabilities](#4-security-vulnerabilities)
5. [Architectural Anti-Patterns](#5-architectural-anti-patterns)
6. [AI Prompt Quality](#6-ai-prompt-quality)
7. [Partially Built / Broken Features](#7-partially-built--broken-features)
8. [Performance Issues](#8-performance-issues)
9. [Missing Features vs. Production Grade](#9-missing-features-vs-production-grade)
10. [Priority Fix List](#10-priority-fix-list)

---

## 1. Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│  Frontend (React + Vite + Tailwind + Motion)               │
│  ├── 8 pages, 9 components, 6 hooks                       │
│  └── Deployed on Vercel                                    │
├────────────────────────────────────────────────────────────┤
│  Backend (Supabase Edge Functions — Deno)                  │
│  ├── parse-resume      — Gemini → extract job titles       │
│  ├── fetch-jobs        — Apify (blocking poll) → ai_jobs   │
│  ├── score-jobs        — Gemini → batch scoring            │
│  ├── rewrite-resume    — Gemini → tailored resume          │
│  ├── ingest-webhook    — Apify webhook → jobs table        │
│  └── check-credits     — Apify usage API                   │
├────────────────────────────────────────────────────────────┤
│  Scraper (Python + GitHub Actions cron)                    │
│  └── Orchestrates Apify actor runs → triggers webhooks     │
├────────────────────────────────────────────────────────────┤
│  Database (Supabase Postgres)                              │
│  ├── jobs             — scraped job listings                │
│  ├── user_sessions    — resume + extracted titles           │
│  ├── ai_jobs          — matched/scored jobs per session     │
│  ├── usage_log        — IP-based rate limiting              │
│  ├── profiles         — auth user profiles                  │
│  ├── user_filters     — per-user scraping config            │
│  └── application_tracker — Kanban tracker (NOT CREATED)     │
└────────────────────────────────────────────────────────────┘
```

---

## 2. File-by-File Audit

### Frontend — Hooks

| File | Purpose | Issues |
|------|---------|--------|
| `useSupabase.jsx` | Creates a shared Supabase client singleton | ✅ Clean. Uses `import.meta.env` correctly. |
| `useAuth.jsx` | Auth context using Supabase Auth + React Query for profile caching | ⚠️ Profile fetch uses `.single()` which throws on 0 rows — new users without a profile hit an error before the DB trigger creates one. No error boundary around this. |
| `useJobs.jsx` | Fetches all jobs, applies client-side filters, computes stats | ⚠️ Fetches **all rows** (`select('*')`) with no pagination. Will scale poorly past ~5k rows. `stats.remote`/`stats.hybrid` counts filter by `work_mode` string but this column is null for many rows. |
| `useSession.jsx` | Manages resume-parse → fetch-jobs → score-jobs pipeline | 🔴 Critical: `parseResume()` and `fetchJobs()` send requests to the edge functions **without an Authorization header**. The `parse-resume` and `fetch-jobs` functions still use `SERVICE_ROLE_KEY`, bypassing RLS entirely. Only `score-jobs` was hardened. `rewriteResume()` also lacks auth. |
| `useTheme.jsx` | Toggle dark/light, persisted in localStorage | ✅ Clean. Minor: `document.documentElement.classList` manipulation is fine but could use a `useLayoutEffect` to avoid FOUC. |
| `useTracker.jsx` | Kanban tracker state from `application_tracker` table + localStorage fallback | 🔴 The `application_tracker` **table does not exist** in any migration. Every call falls back to localStorage silently. The "Supabase sync" code path is dead code that always errors. |

### Frontend — Components

| File | Purpose | Issues |
|------|---------|--------|
| `AnimatedCounter.jsx` | Spring-animated count-up on viewport enter | ✅ Clean. |
| `CommandPalette.jsx` | Cmd+K palette for navigation + sign out | ⚠️ Missing keyboard arrow navigation (footer says "↑↓ Navigate" but it's unimplemented). No `aria-*` attributes for accessibility. |
| `CreditBadge.jsx` | Displays Apify credit remaining | 🔴 Calls `check-credits` without any auth header. Hardcoded Supabase URL. |
| `JobCard.jsx` | 3D tilt card with company initials + metadata | ⚠️ Calls `useTransform` inside JSX (line 78) — this creates a new motion value on every render. Should be hoisted. |
| `Navbar.jsx` | Top navigation with animated underline + user menu | ✅ Clean. Well-structured. |
| `ProtectedRoute.jsx` | Auth guard — redirects to `/auth` if not logged in | ✅ Clean. |
| `ResumeRewriteModal.jsx` | Job detail modal with tailored resume generation | 🔴 Hardcoded `SUPABASE_FUNCTIONS_URL`. No auth header on `rewrite-resume` call. |
| `SkeletonLoader.jsx` | Shimmer skeleton cards / stats / grid | ✅ Clean. |
| `SplashScreen.jsx` | Animated splash with pulsing logo | ✅ Clean. Minor: uninterruptible 1.8s delay on every app load. |
| `Toast.jsx` | Toast notification system with context provider | ✅ Clean. Minor: `setTimeout` in `addToast` should use `useRef` for cleanup on unmount. |

### Frontend — Pages

| File | Purpose | Issues |
|------|---------|--------|
| `AuthPage.jsx` | Sign in / Sign up form | ⚠️ Calls `navigate()` inside render body (line 19) — should be in a `useEffect`. React strict mode will log warnings. |
| `JobsBoard.jsx` | Main jobs table with filters, search, bookmarks, virtual scroll | ⚠️ Bookmarks stored in localStorage only — not synced across devices. `hashColor()` and `initials()` are duplicated here, in `Dashboard.jsx`, in `JobCard.jsx`, and in `ResumeUpload.jsx` (4 copies). |
| `Dashboard.jsx` | Overview with stat cards, pie chart, recent jobs feed | ⚠️ Same `hashColor`/`initials` duplication. Recharts `PieChart` always renders even with 0 data (empty state handled but extra render). |
| `AIDashboard.jsx` | AI-matched jobs grid sorted by relevancy | ⚠️ References "Claude" in loading text (line 199) but actually uses Gemini. Misleading UX copy. |
| `Analytics.jsx` | Bar/line charts + heatmap (last 90 days) | ✅ Functional. Minor: heatmap cells animate individually with `delay: i * 0.005` for 90 items — can be laggy on low-end devices. |
| `ResumeUpload.jsx` | PDF upload → AI parse → tailor resume | 🔴 Hardcoded `SUPABASE_FUNCTIONS_URL`. Constructs a prompt client-side (line 154) but then sends `custom_jd` to edge function, which constructs its own prompt — the client-side prompt is **dead code** (never sent). `hashColor` duplicated again. |
| `Tracker.jsx` | Kanban board with drag-and-drop | 🔴 Entirely broken due to missing `application_tracker` table. Uses HTML5 drag-and-drop, not the installed `@dnd-kit` library. |
| `Settings.jsx` | Scraping preferences, theme toggle, DB status | ⚠️ Supabase endpoint hardcoded in UI text (line 208). `supabaseStatus` is always "connected" — never actually checked. |

### Backend — Edge Functions

| File | Purpose | Issues |
|------|---------|--------|
| `parse-resume/index.ts` | Extracts 5 job titles from resume via Gemini | 🔴 Uses `SERVICE_ROLE_KEY` — bypasses RLS. No auth header check. The error log says "Failed to parse Claude response" (line 69) but uses Gemini — stale comment. Inserts into `user_sessions` without setting `user_id`. |
| `fetch-jobs/index.ts` | Fetches LinkedIn jobs via Apify (blocking poll) | 🔴 Uses `SERVICE_ROLE_KEY`. 5-minute blocking poll per request — Supabase Edge Functions have a **~60s timeout** by default. This function will almost always time out. Rate limiting is IP-based, not user-based. |
| `score-jobs/index.ts` | Batch-scores jobs via Gemini | ✅ Hardened with JWT auth. Well-structured batch processing. |
| `rewrite-resume/index.ts` | Rewrites resume for a specific JD via Gemini | 🔴 Uses `SERVICE_ROLE_KEY`. No auth header check. |
| `ingest-webhook/index.ts` | Processes Apify webhooks → upserts to `jobs` table | ⚠️ All jobs get `role_type: "Uncategorized"` — the role mapping from the scraper's filter context is lost. `APIFY_TOKEN` exposed in query params. No webhook signature verification. |
| `check-credits/index.ts` | Returns Apify usage stats | ⚠️ No auth — anyone can call this to see your Apify usage. Not critical since it's read-only, but info leak. |

### Database Migrations

| File | Issues |
|------|--------|
| `supabase_schema.sql` | Base `jobs` table — ✅ Clean. |
| `20260401_ai_schema.sql` | Creates `user_sessions`, `ai_jobs`, `usage_log` with **public** RLS policies | ⚠️ Public policies are later dropped by `20260423_restrict_rls.sql`, but the migration order must be enforced. |
| `20260408_auth_and_work_mode.sql` | Adds `profiles`, `work_mode`, `user_id` to sessions | ✅ Clean. Good trigger for auto-profile creation. |
| `20260423_restrict_rls.sql` | Drops public policies, adds strict `auth.uid()` policies | 🔴 Breaks `parse-resume` and `rewrite-resume` which still use `SERVICE_ROLE_KEY` (bypasses RLS anyway), but `fetch-jobs` also uses `SERVICE_ROLE_KEY` and isn't setting `user_id` on the session. |
| `20260424_user_filters.sql` | Creates `user_filters` table | ✅ Clean. Properly secured. |

### Scraper

| File | Issues |
|------|--------|
| `scraper.py` | Orchestrator — fetches `user_filters`, dispatches Apify runs with webhook | ⚠️ Uses `SUPABASE_KEY` (service role) to fetch all users' filters. Minor: Naukri dispatch sends `{"desired_results": N}` but doesn't pass the actual role keywords — relies on actor defaults. |
| `requirements.txt` | Just `requests` | ✅ Minimal. |
| `daily.yml` | GitHub Actions cron at 2:30 UTC | ✅ Clean. |

### Config Files

| File | Issues |
|------|--------|
| `vite.config.js` | Minimal Vite config | ✅ Clean. Missing `define` for env vars explanation. |
| `tailwind.config.js` | Extended theme with colors, fonts, animations | ✅ Well-organized. |
| `index.html` | Entry HTML with Google Fonts preconnect | ✅ Good SEO meta tags. |
| `package.json` | Dependencies list | 🔴 Unused deps: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@react-three/drei`, `@react-three/fiber`, `three`. These add ~2MB+ to the bundle for zero functionality. |
| `postcss.config.js` | Tailwind + Autoprefixer | ✅ Clean. |
| `index.css` | Global styles, glassmorphism, animations | ✅ Well-organized design system. |

---

## 3. Dead Code & Unused Dependencies

### Unused npm Packages (bloating bundle)

| Package | Size Impact | Reason Unused |
|---------|-------------|---------------|
| `@dnd-kit/core` | ~50KB | Tracker uses HTML5 drag-and-drop instead |
| `@dnd-kit/sortable` | ~15KB | Never imported |
| `@dnd-kit/utilities` | ~5KB | Never imported |
| `@react-three/fiber` | ~200KB | Never imported — 3D rendering library |
| `@react-three/drei` | ~500KB | Never imported — 3D helpers |
| `three` | ~600KB | Never imported — 3D engine |

**Total estimated waste**: ~1.3MB of gzipped JS that ships to users for zero functionality.

### Dead Code in Source

1. **`ResumeUpload.jsx` line 154-163**: Client-side prompt construction that is never sent — the edge function builds its own prompt.
2. **`useTracker.jsx` line 25-71**: All Supabase sync logic is dead because `application_tracker` table doesn't exist. Always falls back to localStorage.
3. **`parse-resume/index.ts` line 69**: Error message references "Claude" — copy-paste artifact from pre-Gemini era.
4. **`AIDashboard.jsx` line 199**: Loading text says "Claude is analyzing" — should say "Gemini" or "AI".
5. **`ResumeUpload.jsx` line 154**: The `prompt` variable is constructed but never used in the `fetch()` call body.

---

## 4. Security Vulnerabilities

### 🔴 CRITICAL

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | **`parse-resume` uses `SERVICE_ROLE_KEY`** — no auth check, no `user_id` set on session | `parse-resume/index.ts:81-82` | Anyone can create sessions without authenticating. Sessions have no `user_id`, breaking RLS join checks for downstream operations. |
| 2 | **`fetch-jobs` uses `SERVICE_ROLE_KEY`** — no auth check | `fetch-jobs/index.ts:104-106` | Unauthenticated users can trigger expensive Apify scraping runs. IP-based rate limiting is easily bypassed with proxies. |
| 3 | **`rewrite-resume` uses `SERVICE_ROLE_KEY`** — no auth check | `rewrite-resume/index.ts:34-36` | Anyone can generate tailored resumes without authenticating. |
| 4 | **No webhook signature verification on `ingest-webhook`** | `ingest-webhook/index.ts:127` | Anyone can POST fake job data to your database. Apify supports webhook signatures — not verified here. |
| 5 | **Hardcoded Supabase Function URL** in 3 frontend files | `CreditBadge.jsx:4`, `ResumeRewriteModal.jsx:10`, `ResumeUpload.jsx:13` | Should use `import.meta.env.VITE_SUPABASE_URL` to avoid leaking infra topology. |

### ⚠️ MODERATE

| # | Issue | Location |
|---|-------|----------|
| 6 | CORS set to `"*"` on all edge functions | All `index.ts` files | Should restrict to allowed origins in production. |
| 7 | `check-credits` has no auth — exposes Apify usage data | `check-credits/index.ts` |
| 8 | `APIFY_TOKEN` passed in query params | `ingest-webhook/index.ts:161`, `fetch-jobs/index.ts:37` | Tokens in URLs appear in server logs, referrer headers, and Apify's own logs. |

---

## 5. Architectural Anti-Patterns

### 1. Duplicated Utility Functions (DRY violation)
`hashColor()` and `initials()` are copy-pasted in **4 files**:
- `JobCard.jsx`
- `JobsBoard.jsx`
- `Dashboard.jsx`
- `ResumeUpload.jsx`

**Fix**: Extract to `src/utils/format.js`.

### 2. Hardcoded URLs
The Supabase functions URL `https://qlvnnrmilwfxzlotduld.supabase.co/functions/v1` is hardcoded in:
- `CreditBadge.jsx`
- `ResumeRewriteModal.jsx`
- `ResumeUpload.jsx`

But `useSession.jsx` correctly derives it from the Supabase client. Inconsistent.

**Fix**: All edge function calls should go through a centralized API service layer.

### 3. Inconsistent Auth Patterns
- `score-jobs` ✅ uses JWT auth with `Authorization` header
- `parse-resume` ❌ uses `SERVICE_ROLE_KEY`, no auth
- `fetch-jobs` ❌ uses `SERVICE_ROLE_KEY`, no auth
- `rewrite-resume` ❌ uses `SERVICE_ROLE_KEY`, no auth
- `check-credits` ❌ no auth at all
- `ingest-webhook` ✅ service key is appropriate (server-to-server callback)

### 4. Blocking Apify Poll in Edge Function
`fetch-jobs/index.ts` polls Apify every 5 seconds for up to 5 minutes. Supabase Edge Functions typically timeout at 60s. This function **will almost always fail** for any non-cached request.

**Fix**: Convert `fetch-jobs` to use the same async webhook pattern as the daily scraper.

### 5. No Service Layer
Business logic is scattered between hooks, pages, and edge functions:
- Resume parsing prompt lives in `parse-resume`
- Resume rewrite prompt lives in BOTH `ResumeUpload.jsx` (dead) AND `rewrite-resume`
- Job scoring prompt lives in `score-jobs`
- Filtering/stats computation lives in `useJobs.jsx`

**Fix**: Create `src/services/` directory with clear separation.

### 6. No Error Boundaries
No React Error Boundaries anywhere. A single component crash takes down the entire app.

---

## 6. AI Prompt Quality

### `parse-resume` — Job Title Extraction
```
Extract job titles this person is best suited for.
Return exactly 5 job titles as a JSON array.
```
**Grade: C**. Too vague. No role-level guidance (junior/senior), no industry context, no output format constraints.

### `score-jobs` — Relevancy Scoring
```
Score each job for relevancy... relevancy_score (number 0-100)...
```
**Grade: B**. Good structure with explicit JSON schema. Could improve with:
- Scoring rubric (what makes 90 vs 60?)
- Skill extraction step before scoring
- Weight categories (technical fit, seniority fit, domain fit)

### `rewrite-resume` — Resume Tailoring
```
Rewrite this resume to better match this job description.
Keep all facts true, only reframe wording...
```
**Grade: B-**. Good instruction but no ATS keyword optimization guidance. Output is plain text — no structured sections. No before/after diff to show what changed.

---

## 7. Partially Built / Broken Features

| Feature | Status | What's Wrong |
|---------|--------|--------------|
| **Application Tracker** | 🔴 Broken | `application_tracker` table never created. `useTracker.jsx` silently falls back to localStorage. Drag-and-drop "works" on screen but data is ephemeral. |
| **Keyboard Navigation in Command Palette** | ⚠️ Incomplete | Footer says "↑↓ Navigate" and "↵ Open" but arrow key handling is not implemented. Only mouse clicks work. |
| **Light Mode** | ⚠️ Partial | `index.css` has `html:not(.dark)` overrides but they only cover a few components. Most pages will have broken contrast/colors in light mode. |
| **CreditBadge** | ⚠️ Unreliable | Calls `check-credits` without auth. The Apify plan structure may not match the field assumptions (`plan.monthlyUsageUsd`). |
| **Work Mode Classification** | ⚠️ Inconsistent | Backfill migration sets `work_mode` based on keyword matching, but new jobs from `ingest-webhook` always get `role_type: "Uncategorized"` and no `work_mode`. |
| **PDF Download for Tailored Resume** | ⚠️ Text-only | Downloads as `.txt` file. No PDF generation, no formatting, no ATS-friendly structure. |

---

## 8. Performance Issues

| Issue | Impact | Location |
|-------|--------|----------|
| **All 6 unused 3D/drag libraries shipped to client** | +1.3MB bundle size | `package.json` |
| **`useJobs` fetches ALL rows with `select('*')`** | Unbounded query — will OOM with large datasets | `useJobs.jsx:42` |
| **90 heatmap cells each have staggered animation** | Janky on low-end devices (90 × 0.005s delays) | `Analytics.jsx:133` |
| **`JobCard.jsx` creates motion value inside JSX** | New `useTransform` call on every render | `JobCard.jsx:78` |
| **Splash screen is 1.8s with no skip** | Forced delay on every app load, even returning users | `App.jsx:39` |
| **No `React.memo` on any component** | Unnecessary re-renders on filter changes in JobsBoard | All components |

---

## 9. Missing Features vs. Production Grade

| Gap | Priority | Description |
|-----|----------|-------------|
| **No error boundaries** | P0 | Single component crash kills the app |
| **No loading/error states on edge fn calls** | P0 | Network errors silently swallowed in multiple places |
| **No pagination or infinite scroll** | P1 | `select('*')` fetches all rows |
| **No email verification flow** | P1 | Users can sign up with any email |
| **No password reset** | P1 | No "forgot password" functionality |
| **No rate limiting on Gemini calls** | P1 | Users can spam AI operations |
| **No application_tracker migration** | P1 | Entire Tracker page is non-functional |
| **No structured resume output** | P2 | Tailored resume is plain text, not PDF |
| **No job expiry/archiving** | P2 | Old jobs linger forever |
| **No user onboarding** | P2 | New users see empty state with no guidance |
| **No API request retry logic** | P2 | Gemini/Apify failures are not retried |
| **No centralized error logging** | P2 | `console.error` only — no Sentry, no monitoring |
| **No CI/CD for frontend** | P3 | Only scraper has GitHub Actions |
| **No tests** | P3 | Zero unit, integration, or e2e tests |

---

## 10. Priority Fix List

### Tier 1 — Fix Now (Security + Broken Features)

1. **Harden all edge functions with JWT auth** — `parse-resume`, `fetch-jobs`, `rewrite-resume`, `check-credits` must require `Authorization: Bearer <JWT>` like `score-jobs` already does.
2. **Set `user_id` on `user_sessions`** — `parse-resume` must extract `user_id` from the JWT and set it on insert. Without this, RLS policies block all downstream queries.
3. **Create `application_tracker` table migration** — or remove the Tracker page entirely.
4. **Remove hardcoded Supabase URLs** from `CreditBadge`, `ResumeRewriteModal`, `ResumeUpload` — use env vars or the shared Supabase client.
5. **Fix `fetch-jobs` timeout** — replace the blocking Apify poll with an async webhook pattern.

### Tier 2 — Clean Up (DRY + Performance)

6. **Remove 6 unused npm packages** (`@dnd-kit/*`, `@react-three/*`, `three`).
7. **Extract `hashColor()`, `initials()`, `formatDate()`, `scoreColor()`** to `src/utils/`.
8. **Create `src/services/api.js`** — centralize all edge function calls with auth headers.
9. **Add React Error Boundary** at the app level.
10. **Add pagination** to `useJobs` — `LIMIT 100` with cursor-based pagination.

### Tier 3 — Upgrade (Feature Quality)

11. **Add `work_mode` classification** to `ingest-webhook` — parse from description keywords.
12. **Fix `role_type` in `ingest-webhook`** — currently hardcoded to "Uncategorized".
13. **Implement Command Palette keyboard navigation**.
14. **Fix light mode** or remove the toggle.
15. **Add Apify webhook signature verification** on `ingest-webhook`.
16. **Remove dead prompt code** from `ResumeUpload.jsx`.
17. **Fix "Claude" references** → "Gemini" in `parse-resume` and `AIDashboard`.
18. **Fix `AuthPage.jsx`** — move `navigate()` from render body to `useEffect`.
