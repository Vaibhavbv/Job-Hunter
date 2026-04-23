# Changelog — Job Hunter v3.0

## [3.0.0] — 2026-04-23

### Major: AI Evaluation Engine (Phases 3–4)
- **`evaluate-jobs` edge function** — 5-dimension scoring system (technical, seniority, domain, salary, location) with weighted averages, gate-fail logic, grade/archetype/recommendation computation
- **`rewrite-resume` enhanced** — Structured Gemini prompt with ATS optimization, keyword extraction, and auto-save to `resumes` table
- **`ingest-webhook` enhanced** — Scan history tracking for run deduplication, ghost job detection (5 signals), experience field extraction from JD
- **Evaluation models**: Grades (A+ through F), Archetypes (Dream Job, Strong Match, Worth Trying, Stretch, Mismatch, Dealbreaker), Recommendations (Apply Now, Worth Trying, Maybe Later, Skip)

### Major: UI Overhaul (Phase 5)
- **Dashboard** — Grade distribution bar chart, 5-dimension radar chart, archetype donut chart, top matches feed with scores
- **AI Dashboard (renamed "AI Evaluations")** — 5-dimension evaluation cards with animated mini-bars, archetype/recommendation badges, recommendation filter tabs, sort controls
- **Jobs Board** — Grade column with colored badges, grade filter chips, evaluation data integration via lookup map
- **Analytics** — Pipeline funnel (Scraped→Evaluated→Passed Gate→Worth Trying→Apply Now), score distribution histogram, dimension comparison (All vs Top), improved heatmap performance

### Major: Batch Evaluation (Phase 6)
- **"Evaluate All Pending"** button with animated progress bar and batch messages
- Loop processing (up to 10 rounds × 20 jobs) until all pending jobs are evaluated
- Real-time progress counter showing current/total evaluations
- Pending count badge in header

### Major: User Profile Configuration (Phase 7)
- **Candidate Profile** section in Settings with:
  - Headline and bio text fields
  - Skills tag input (Enter-to-add, click-to-remove)
  - Target Roles tag input with colored badges
  - Preferred Locations tag input
  - Experience years and minimum salary fields
  - Base resume status indicator
- Profile saves to `profiles` table and invalidates auth cache
- Color-coded tag badges per category (green=skills, blue=roles, purple=locations)

### Schema Upgrade (Phase 2)
- `evaluations` table with 5-dimension scores, grade, archetype, gate_fail, recommendation
- `resumes` table for persistent tailored resume storage
- `scan_history` table for Apify run deduplication
- `profiles` enhancements: base_resume, skills, preferred_roles, min_salary, experience_years, headline, bio, preferred_locations
- `jobs` enhancements: is_ghost, status, apify_run_id, experience, company_size, scraped_at
- RLS policies on all new tables

### Frontend Infrastructure
- `useEvaluations` hook with computed stats, batch evaluation, and filtering helpers
- `api.js` service layer with `evaluateJobs()` endpoint
- Fixed `signOut` bug (was calling non-existent `setProfile`, now uses `queryClient.removeQueries`)
- Version bumped to v3.0 in Settings

### Bug Fixes
- Fixed `signOut` referencing `setProfile` which doesn't exist
- Heatmap animation delay capped at 300ms (was unbounded)
