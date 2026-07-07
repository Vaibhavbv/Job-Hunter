# Job Hunter — Product Strategy & Go-To-Market

> **Status:** Strategy proposal (v1). India-first, hybrid monetization, "AI Application
> Copilot" positioning. All prices and percentages below are **recommended, tunable
> assumptions** — the unit-economics numbers must be validated against real Gemini/Apify
> billing during the first build phase (see [ROADMAP.md](./ROADMAP.md), Phase A).

---

## 0. TL;DR

Job Hunter already has the hard part built: a **per-user AI layer** (5-dimension job
evaluations, ATS resume tailoring, application tracker) sitting on top of a **shared, daily,
India-tuned job pool**. The path to a paying product is not "build a job board" — it's
**wrap the AI layer in billing, put a free funnel in front of it, and let the shared board
keep sourcing costs flat while users scale.**

- **Wedge:** *AI Application Copilot* — "every job scored to your resume, and a resume
  auto-tailored to each one in seconds."
- **Market:** India-first (existing Naukri/Indeed-IN scrapers, ₹ pricing, huge active-seeker
  volume, low CAC).
- **Model:** Hybrid — **Free** (funnel) + **Credits** (pay-as-you-go) + **Pro** (subscription).
- **Why it prints money:** the expensive part (scraping) is *shared and amortized across all
  users*; the paid part (Gemini AI actions) is *cheap per action*. That's a ~75%+ gross-margin
  SaaS from day one.

---

## 1. Where we are today (the honest baseline)

| Asset | State | Implication |
|---|---|---|
| Per-user AI evaluations (`evaluations`, unique per user×job) | **Built, RLS-secured** | The paid magic already works. |
| ATS resume tailoring (`resumes`, `rewrite-resume`) | **Built** | High-WTP feature ready. |
| Application tracker (`application_tracker`) | **Built** | Retention surface ready. |
| Shared job pool (`jobs`, `scraper.py`, `ingest-webhook`) | **Built, global/shared** | Margin moat — flat sourcing cost. |
| Billing / plans / entitlements | **Does not exist** | Blocks selling. Phase A. |
| Public landing / pricing / SEO surface | **Does not exist** (all behind auth) | Blocks acquisition. Phase B. |
| Legal / DPDP / trust | **Does not exist** | Blocks scale. Phase D. |

The product is a strong *engine* with no *storefront* and no *cash register*. This plan builds
those two things without rewriting the engine.

---

## 2. Positioning & Wedge — "AI Application Copilot"

**Headline:** *"Stop applying blind. Every job scored to your resume — and a resume
auto-tailored to each one, in seconds."*

**Sub-head:** *We scan LinkedIn, Naukri & Indeed every day, grade each job A+ to F against your
actual profile, and rewrite your resume to beat the ATS — so you apply to the right 5, not the
random 50.*

### Why this wedge (vs. the alternatives)

| Candidate positioning | Verdict |
|---|---|
| **AI Application Copilot** ✅ | The per-user AI layer is already built, defensible, and high willingness-to-pay. The board becomes a *free funnel*, which is exactly what the shared-jobs architecture is good at. **Chosen.** |
| "Freshest AI job board" | Boards are commoditized (Naukri/LinkedIn own this) and hard to charge for. Good as the *free hook*, weak as the *paid product*. |
| "Auto-apply autopilot" | Over-promises vs. what's built (no application automation yet). Grow *into* this later as expansion, don't lead with it. |

### Competitive framing (India)

- **Naukri/LinkedIn/Indeed:** distribution giants, but noisy, no per-user scoring, no resume
  tailoring. We sit *on top* of them and add judgment.
- **Global copilots (Teal, Simplify, Huntr, Careerflow):** strong products but US-priced and
  US-sourced. We win India on price (₹), local sourcing, and WhatsApp-native alerts.
- **Our moat:** proprietary daily-scraped data + a per-user scoring model + India-native
  pricing/distribution. Cost structure (shared sourcing) makes us hard to undercut.

---

## 3. ICP — who we sell to first

| Segment | Who | Pain | Why they pay |
|---|---|---|---|
| **Primary** | Early-to-mid career (0–8 yrs) tech & adjacent — SDE, data/analyst, product, marketing | Apply at volume, get ghosted; resumes aren't ATS-tuned | A job is livelihood; outcome tools convert even when price-sensitive |
| **Secondary** | Career switchers; tier-2/3 college grads | Lack resume/interview polish; don't know what to apply to | Huge, underserved, high-volume; strong word-of-mouth |
| **Later (expansion)** | Campus placement cells, bootcamps, upskilling platforms | Need to place cohorts | B2B seats / white-label |

**Why India wins first:** the scrapers already target it (Naukri, Indeed `country=in`), there's
enormous active-seeker volume, CAC is low via LinkedIn/campus/Telegram-WhatsApp job groups and
YouTube, and outcome-based tools convert despite price sensitivity.

---

## 4. Monetization — Hybrid (Free + Credits + Pro)

The only metered cost is **AI actions** (a Gemini evaluation or a resume rewrite). **The job
board is always free** — that's the funnel, and it costs us ~nothing per extra user.

**Credit accounting:** `1 credit = 1 job evaluation`, `3 credits = 1 resume tailor`.

| Tier | Price (recommended, tunable) | Included | Purpose |
|---|---|---|---|
| **Free** | ₹0 | Full board browse/search/filter · **10 evaluations/mo** · **1 resume tailor/mo** · basic tracker · weekly email digest | Acquisition funnel + SEO surface |
| **Credits** (pay-as-you-go) | ₹99 = 50 credits · ₹299 = 175 credits · ₹599 = 400 credits | Spend on evaluations/resume tailors; credits valid 12 months | Convert light/occasional users who won't subscribe |
| **Pro** | **₹399/mo** or **₹2,999/yr** (~37% off) | **Unlimited** evaluations · resume tailoring (fair-use ~100/mo) · **daily A+ match alerts (email + WhatsApp)** · full tracker · priority scraping of *their* filters · advanced analytics + export | Core recurring revenue |
| **Pro+ / Coaching** *(later)* | ₹999/mo | AI interview prep + mock interviews · human resume review · referrals marketplace | Expansion / ARPU lift |

**Conversion levers:** 7-day Pro trial (card optional), annual discount, student/campus pricing,
both-sided referral credits, and a hard-but-fair free cap that produces a natural paywall moment
right after the "aha."

**Payments:** Razorpay (UPI/cards/netbanking) for India. Subscriptions + one-time credit orders
both supported by Razorpay; a webhook edge function reconciles payment → entitlement.

---

## 5. Unit Economics — why the margins are the story

The whole thesis: **sourcing cost is shared and flat; AI cost is cheap and per-action.**

### Cost drivers

| Driver | Nature | Approx cost | Notes |
|---|---|---|---|
| Apify scraping | **Shared across ALL users** | ~₹400/mo total (₹0 marginal per user) | Global `jobs` pool → cost per user → 0 as base grows |
| Gemini 2.5 Flash (eval) | Per AI action | ~₹0.5–1.5 / eval | A few K tokens in/out; **validate in Phase A** |
| Gemini 2.5 Flash (resume rewrite) | Per AI action | ~₹1.5–4 / rewrite | Larger context; **validate in Phase A** |
| Supabase + Vercel | Fixed | Free → ~$25/mo each at scale | Grows in steps, not per user |

### Illustrative margins (validate the AI unit cost before trusting these)

- **Pro user:** ₹399/mo, ~60 AI actions × ~₹1.5 ≈ **₹90 COGS → ~77% gross margin.** Even a heavy
  user at the ~100 fair-use rewrites is comfortably profitable.
- **Free user:** bounded by the 10-eval + 1-rewrite cap ≈ **₹15–30/mo** in AI cost, and adds
  ~₹0 scraping cost. A sustainable loss-leader funnel.
- **Credit buyer:** ₹99/50 credits with ~₹1/credit COGS → ~50% margin on top-ups, plus these
  users are warm upsell targets for Pro.

### Break-even (illustrative, fixed cost ≈ ₹5,000/mo at small scale)

| Pro users | Pro MRR | Covers fixed cost? |
|---|---|---|
| 15 | ₹5,985 | ✅ break-even on infra |
| 50 | ₹19,950 | Comfortable |
| 250 | ₹99,750 | ~₹1L MRR milestone |
| 1,000 | ₹3,99,000 | Scale economics kick in |

### CAC / LTV targets

- **CAC:** target < ₹150 blended via organic (SEO + free ATS tool + community). Paid ads only
  after the funnel converts organically.
- **LTV:** at ₹399/mo and a target ~6-month Pro lifetime (early assumption) → ~₹2,400 LTV →
  **LTV:CAC ~16:1** if CAC holds. Even at 3-month lifetime it's healthy. Retention is the number
  to watch obsessively.

---

## 6. Growth Engine (India-specific GTM)

1. **Programmatic SEO off the shared board.** Thousands of indexable job pages + "AI resume for
   `<role>`" and "`<role>` jobs in `<city>`" pages. We currently have **zero public pages** — this
   is the single biggest untapped lever.
2. **Free ungated "Resume ATS Score" tool.** Paste resume → instant AI score + top-3 fixes →
   sign up to actually fix it. Shareable score = viral loop and the top of the funnel.
3. **Community distribution.** LinkedIn build-in-public, Telegram/WhatsApp job groups,
   r/developersIndia, campus ambassadors, YouTube "how I got N interviews with this."
4. **Both-sided referral credits.** Invite a friend → both get credits (fits the credit ledger).
5. **WhatsApp daily A+ alerts.** India-native re-engagement channel; a retention engine, not just
   notification.
6. **Proprietary-data content.** Weekly "hottest roles / top hiring companies this week" pulled
   from our own scrape data — linkbait no one else can publish.

**Funnel:** SEO/free tool/community → sign up (Free) → set profile + upload resume → see first
graded matches + one free tailored resume (**aha**) → hit the free cap → **Pro trial / credit
top-up** → daily alerts pull them back → referral loop.

---

## 7. KPIs

| Stage | Metric | Early target |
|---|---|---|
| Acquisition | Organic signups/week; free-tool → signup rate | grow WoW |
| Activation | % who reach first graded match **and** first tailored resume | > 60% |
| Revenue | Free → paid conversion (Pro + credits) | 3–6% |
| Revenue | Pro MRR; credit ARPU | ₹1L MRR by ~M3–4 |
| Retention | Pro monthly churn; WAU/MAU | churn < 8%/mo |
| Efficiency | LTV:CAC | > 3:1 (aim 10:1 organic) |

---

## 8. 90-Day Launch Plan

- **Month 1 — Build the storefront + register.** Ship the monetization spine (Phase A) and
  conversion funnel (Phase B). Run a **closed beta (~50 hand-picked seekers)** for feedback and
  testimonials. Instrument analytics from day one.
- **Month 2 — Public launch.** Ship the free ATS-score tool, seed programmatic SEO, launch on
  LinkedIn/communities, turn on payments. Goal: **first ₹ and first 10 paying users.**
- **Month 3 — Grow the loops.** Ship email + WhatsApp alerts and referrals (Phase C), optimize
  the free→paid conversion, publish weekly data content. Goal: **an MRR milestone (e.g. ₹50k–₹1L)
  and a validated LTV:CAC.**

Everything after that (interview prep, coaching, B2B/campus) is expansion — see
[ROADMAP.md](./ROADMAP.md), Phase E.

---

## 9. Key risks & mitigations

| Risk | Mitigation |
|---|---|
| AI unit cost higher than modeled | Validate real Gemini token cost in Phase A **before** promising "unlimited"; the fair-use cap bounds it |
| Scraper/Apify actor breakage kills data freshness (trust in grades) | Monitor `scan_history`, alert on empty runs, keep multiple sources so one failure isn't fatal |
| Resume PII / DPDP Act compliance | Phase D: explicit consent, data-deletion, minimal retention, ToS/Privacy before scaling |
| Free tier abused for cost | Per-user metering + rate limits + email verification gate on AI actions |
| Low free→paid conversion | The paywall lands right after the aha; trial + credits reduce commitment; iterate on the moment |
| Board commoditization | We don't sell the board — we sell judgment (scoring) + resume outcomes on top of it |

---

## 10. What this means for the build

This strategy is executed as five phases in **[ROADMAP.md](./ROADMAP.md)**:

- **Phase A — Monetization spine** (plans, credit ledger, Razorpay, entitlements, metering)
- **Phase B — Conversion funnel** (landing, pricing, free ATS tool, onboarding, SEO)
- **Phase C — Retention/growth loops** (alerts, referrals, digests)
- **Phase D — Trust & ops** (legal/DPDP, monitoring, rate limiting, CORS lockdown)
- **Phase E — Expansion** (interview prep, coaching, Pro+, B2B/campus)
