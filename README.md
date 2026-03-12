# 🎯 Vaibhav's Job Dashboard

A fully automated personal job dashboard that scrapes **40–50 fresh jobs daily** from LinkedIn, Naukri, and Indeed — stores them in Supabase — and displays them on a beautiful hosted website. **100% free** (or near-free).

| Component | Tech | Cost |
|-----------|------|------|
| Scraper | Python + Apify REST API | ~$1.50/mo (within Apify's free $5 credits) |
| Database | Supabase (Postgres) | Free tier (500 MB) |
| Scheduler | GitHub Actions cron | Free (public/private repos) |
| Frontend | Vanilla HTML/CSS/JS | Free |
| Hosting | Vercel | Free tier |

---

## 📁 Project Structure

```
job-dashboard/
├── scraper/
│   ├── scraper.py          ← Daily scraper script
│   └── requirements.txt    ← Python dependencies
├── frontend/
│   └── index.html          ← Dashboard UI
├── .github/
│   └── workflows/
│       └── daily.yml       ← GitHub Actions cron workflow
├── supabase_schema.sql     ← One-time database setup
└── README.md               ← This file
```

---

## 🚀 Setup Guide

Follow these steps in order. Total setup time: ~15 minutes.

### Step 1: Supabase (Database)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project** → give it a name (e.g., `job-dashboard`) → set a password → pick a region close to you → click **Create**
3. Wait ~2 minutes for provisioning
4. Go to **SQL Editor** (left sidebar) → click **New query**
5. Copy-paste the entire contents of `supabase_schema.sql` into the editor → click **Run**
6. You should see: `Success. No rows returned` — that means the table was created
7. Now get your credentials:
   - Go to **Settings** → **API** (left sidebar)
   - Copy **Project URL** (looks like `https://abc123.supabase.co`)
   - Copy **anon public** key (the long key under `Project API keys`)

### Step 2: Apify (Scraping Engine)

1. Go to [apify.com](https://apify.com) and create a free account
2. You get **$5/month in free credits** — this project uses ~$1.50–$3.15/month
3. Go to **Settings** → **Integrations** → copy your **API token**

### Step 3: GitHub (Repository + Secrets)

1. Create a **new repository** on GitHub (can be private)
2. Push this entire project to the repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit — Job Dashboard"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
3. Go to your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
4. Add these 3 secrets:

   | Secret Name | Value |
   |-------------|-------|
   | `APIFY_TOKEN` | Your Apify API token from Step 2 |
   | `SUPABASE_URL` | Your Supabase Project URL (e.g., `https://abc123.supabase.co`) |
   | `SUPABASE_KEY` | Your Supabase **service_role** key (for write access) |

   > ⚠️ **Important:** Use the **service_role** key (not anon key) for the scraper, because it needs write access to insert rows.

### Step 4: Frontend (Add Credentials)

1. Open `frontend/index.html` in a text editor
2. Find these two lines near the top of the `<script>` section:
   ```js
   const SUPABASE_URL  = "YOUR_SUPABASE_URL";
   const SUPABASE_KEY  = "YOUR_SUPABASE_ANON_KEY";
   ```
3. Replace with your **actual Supabase URL** and **anon public key**:
   ```js
   const SUPABASE_URL  = "https://abc123.supabase.co";
   const SUPABASE_KEY  = "eyJhbGci...your-anon-key...";
   ```
4. Commit and push:
   ```bash
   git add frontend/index.html
   git commit -m "Add Supabase credentials to frontend"
   git push
   ```

### Step 5: Deploy to Vercel (Free Hosting)

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New** → **Project** → Import your job-dashboard repo
3. In the configuration screen:
   - **Root Directory:** Click **Edit** → type `frontend` → click **Continue**
   - **Framework Preset:** Leave as `Other`
4. Click **Deploy**
5. In ~30 seconds you'll get a live URL like `https://your-project.vercel.app` 🎉

### Step 6: Run Scraper for the First Time

1. Go to your GitHub repo → **Actions** tab
2. Click **Daily Job Scraper** on the left
3. Click **Run workflow** → **Run workflow** (green button)
4. Wait ~3–5 minutes for it to complete
5. Refresh your Vercel dashboard — you should see jobs appearing!

---

## ⏰ How It Works

```
Daily at 8:00 AM IST
        ↓
GitHub Actions triggers scraper.py
        ↓
Scraper calls Apify API for 10 roles × 3 platforms
        ↓
Deduplicates results (URL → title|company → DB upsert)
        ↓
~40–50 unique jobs saved to Supabase
        ↓
Dashboard fetches & displays data from Supabase
```

The scraper runs automatically every day. No manual intervention needed.

---

## 🛠️ Manual Run

You can trigger the scraper anytime from: **GitHub repo → Actions → Daily Job Scraper → Run workflow**

---

## 💰 Monthly Cost Breakdown

| Service | Usage | Cost |
|---------|-------|------|
| Apify | 10 roles × 3 platforms × 5 results × 30 days | ~$1.50–$3.15 (within free $5 credits) |
| Supabase | ~5 MB/month of job data | Free (500 MB limit) |
| GitHub Actions | ~5 min/day runtime | Free |
| Vercel | Static site hosting | Free |
| **Total** | | **$0/month** ✅ |

---

## 🔧 Customization

### Change Job Roles
Edit the `JOB_ROLES` list in `scraper/scraper.py`:
```python
JOB_ROLES = [
    "Data Engineer",
    "Data Analyst",
    # Add or remove roles here
]
```

### Change Location
Edit the LinkedIn URL and Indeed input in `scraper.py` — search for `Gurgaon` and replace with your city.

### Change Schedule
Edit `.github/workflows/daily.yml` — change the cron expression. Use [crontab.guru](https://crontab.guru) to help.

---

## 📋 Job Roles Tracked

1. Data Engineer
2. Data Analyst
3. Business Analyst
4. Analytics Engineer
5. ETL Developer
6. BI Developer
7. SQL Developer
8. Python Developer
9. Backend Engineer
10. Product Analyst

---

## 🤝 Tech Stack

- **Python 3.11** — scraper logic
- **Apify REST API** — web scraping actors for LinkedIn, Naukri, Indeed
- **Supabase** — PostgreSQL database with REST API
- **GitHub Actions** — daily cron scheduler
- **Vanilla HTML/CSS/JS** — frontend dashboard
- **Vercel** — static site hosting
