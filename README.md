# Job Hunter

An AI-powered job search dashboard. A daily scraper pulls fresh listings from LinkedIn, Naukri, and Indeed into Supabase; a Gemini-backed evaluation engine scores each job against your resume and profile across 5 dimensions; and a React dashboard lets you browse, filter, track applications, and get an AI-tailored resume for any listing.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite 5, React Router, TanStack Query, Tailwind CSS, Framer Motion |
| Backend | Supabase (Postgres + Auth + Row-Level Security) + Deno Edge Functions |
| AI | Google Gemini (resume parsing, resume rewriting, job evaluation/scoring) |
| Scraper | Python 3.11 orchestrator + Apify actors (LinkedIn, Naukri, Indeed) |
| Scheduler | GitHub Actions (daily cron) |
| Hosting | Vercel (frontend) |

## How It Works

```
GitHub Actions (daily cron)
        │
        ▼
scraper/scraper.py  ──triggers──▶  Apify actors (LinkedIn / Naukri / Indeed)
                                            │
                                            ▼  webhook on completion
                              supabase/functions/ingest-webhook
                              (dedupes, ghost-job detection, writes to `jobs`)
                                            │
                                            ▼
                                    Supabase Postgres
                                            │
                  ┌─────────────────────────┼─────────────────────────┐
                  ▼                         ▼                         ▼
        evaluate-jobs (Gemini)      parse-resume / rewrite-resume   fetch-jobs / check-credits
        5-dim scoring per job       (Gemini, user-triggered)        (read APIs for the frontend)
                  │                         │                         │
                  └─────────────────────────┴─────────────────────────┘
                                            │
                                            ▼
                              React frontend (Vite, deployed on Vercel)
```

The scraper itself is a thin orchestrator — it only queries `user_filters` and kicks off Apify runs. All extraction, deduplication, and persistence logic lives in the `ingest-webhook` Edge Function, which Apify calls when each run finishes.

## Features

- **Job board** — scraped listings with AI grade badges (A+–F), filtering, and search
- **AI evaluation engine** — each job is scored across 5 dimensions (technical fit, seniority, domain, salary, location) against your profile/resume, producing a grade, an archetype (Dream Job, Strong Match, Worth Trying, Stretch, Mismatch, Dealbreaker), and a recommendation (Apply Now / Worth Trying / Maybe Later / Skip)
- **Resume tools** — upload a PDF resume for AI parsing, then get an ATS-optimized, job-specific rewrite via Gemini
- **Application tracker** — track status per job through your pipeline
- **Dashboard & analytics** — grade distribution, 5-dimension radar chart, archetype breakdown, pipeline funnel (Scraped → Evaluated → Passed Gate → Worth Trying → Apply Now)
- **Auth & profiles** — Supabase Auth with a candidate profile (skills, target roles, preferred locations, salary floor) that feeds the evaluation engine
- **Command palette**, credit usage badge, toasts, and an error boundary with recovery

See `CHANGELOG.md` for the version history of these features.

## Project Structure

```
job-hunter/
├── frontend/                  React 18 + Vite SPA
│   ├── src/
│   │   ├── components/        Reusable UI (JobCard, Navbar, CommandPalette, ErrorBoundary, ...)
│   │   ├── hooks/              useAuth, useJobs, useEvaluations, useTracker, useSupabase, ...
│   │   ├── pages/              JobsBoard, Dashboard, AIDashboard, Analytics, Tracker, ResumeUpload, Settings, AuthPage
│   │   ├── services/api.js     Centralized Supabase Edge Function client
│   │   ├── utils/               Shared formatting helpers (TypeScript)
│   │   └── test/                Vitest setup
│   ├── eslint.config.js, tsconfig.json, vite.config.js
│   └── .env.example
├── supabase/
│   ├── functions/              Deno Edge Functions (see table below)
│   ├── migrations/              SQL schema migrations, applied in filename order
│   └── .env.example             Edge Function secrets reference
├── scraper/
│   ├── scraper.py               Daily orchestrator (queries filters, triggers Apify)
│   ├── requirements.txt
│   └── .env.example
└── .github/workflows/
    ├── daily.yml                 Scraper cron (2:30 AM UTC / 8:00 AM IST)
    └── frontend-ci.yml           Lint, typecheck, test, build on every push/PR
```

### Edge Functions

| Function | Purpose |
|---|---|
| `fetch-jobs` | Reads jobs for the frontend, triggers new Apify scrape runs |
| `ingest-webhook` | Apify webhook target — dedupes, detects ghost jobs, writes to `jobs` and `scan_history` |
| `parse-resume` | Gemini-based resume PDF text → structured profile data |
| `rewrite-resume` | Gemini-based ATS-optimized, job-tailored resume rewrite |
| `evaluate-jobs` | 5-dimension Gemini scoring of jobs against the user's profile |
| `score-jobs` | Lightweight scoring path (no full evaluation) |
| `check-credits` | Reports remaining Apify/Gemini usage budget |

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run each file in `supabase/migrations/` **in filename order** (they're timestamped). `supabase_schema.sql` at the repo root is the original v1 schema, kept for historical reference — new setups should use the migrations directory.
3. Under Settings → API, copy the **Project URL**, **anon public key**, and **service_role key**.
4. Deploy the Edge Functions with the [Supabase CLI](https://supabase.com/docs/guides/cli):
   ```bash
   supabase functions deploy fetch-jobs ingest-webhook parse-resume rewrite-resume evaluate-jobs score-jobs check-credits
   ```
5. Set the Edge Function secrets (see `supabase/.env.example` for what each one is for):
   ```bash
   supabase secrets set GEMINI_API_KEY=... APIFY_TOKEN=...
   ```
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase into every deployed function — you don't set those yourself.

### 2. Apify

1. Create a free account at [apify.com](https://apify.com) (the free tier's $5/month credit comfortably covers this project's usage).
2. Copy your API token from Settings → Integrations.

### 3. Google Gemini

1. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey).

### 4. GitHub Actions (scraper cron)

Add repository secrets under Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `APIFY_TOKEN` | Your Apify API token |
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_KEY` | Your Supabase **service_role** key |

The `daily.yml` workflow runs `scraper/scraper.py` automatically every day at 8:00 AM IST, and can also be triggered manually from the Actions tab.

### 5. Frontend

```bash
cd frontend
cp .env.example .env.local   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Deploy to Vercel with **Root Directory** set to `frontend` and the same two env vars configured in the Vercel project settings.

## Development

All commands run from `frontend/`:

```bash
npm run dev         # start the Vite dev server
npm run lint         # ESLint
npm run typecheck   # tsc --noEmit
npm run test         # Vitest, watch mode
npm run test:run     # Vitest, single run
npm run build        # production build
```

`frontend-ci.yml` runs lint, typecheck, tests, and the build on every push and pull request that touches `frontend/`.

The codebase is mid-migration from JavaScript to TypeScript: `tsconfig.json` has `allowJs: true` so `.jsx`/`.js` files coexist with `.tsx`/`.ts` files, and new/converted files are typed incrementally rather than all at once.
