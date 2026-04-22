"""
Job Dashboard Scraper (Webhook Orchestrator)
============================================
Scrapes jobs from LinkedIn, Naukri, and Indeed via Apify actors.
This script acts purely as an orchestrator. It queries `user_filters`
from Supabase to determine what to search, and POSTs the runs to Apify.

Extraction and filtering logic now lives in the `ingest-webhook` Edge Function
which Apify calls upon completion.

Runs daily via GitHub Actions cron at 8:00 AM IST (2:30 AM UTC).
"""

import os
import requests
import logging
from datetime import datetime

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

APIFY_TOKEN   = os.environ.get("APIFY_TOKEN")
SUPABASE_URL  = os.environ.get("SUPABASE_URL")
SUPABASE_KEY  = os.environ.get("SUPABASE_KEY")

APIFY_BASE    = "https://api.apify.com/v2"

WEBHOOK_URL   = f"{SUPABASE_URL}/functions/v1/ingest-webhook"

# Apify actor IDs
ACTORS = {
    "LinkedIn": "curious_coder~linkedin-jobs-scraper",
    "Naukri":   "codemaverick~naukri-job-scraper-latest",
    "Indeed":   "valig~indeed-jobs-scraper",
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-8s  %(message)s")
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_user_filters() -> list[dict]:
    """Fetch active scraping filters dynamically from Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/user_filters?is_active=eq.true"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    resp = requests.get(url, headers=headers)
    resp.raise_for_status()
    return resp.json()

def start_apify_actor(actor_id: str, run_input: dict, max_items: int | None = None):
    """
    Start an Apify actor asynchronously. Pass the Webhook URL so the Edge Function
    handles the downloaded dataset once complete.
    """
    start_url = f"{APIFY_BASE}/acts/{actor_id}/runs?token={APIFY_TOKEN}"
    if max_items:
        start_url += f"&maxItems={max_items}"
        
    payload = run_input
    # Appending webhooks to query params is supported by Apify API v2, but typically 
    # for run inputs, passing webhooks as a query param `webhooks` encoded string or in the body is robust.
    # Actually, we can just define webhooks array in a separate query param or via the API client.
    # According to Apify Docs: POST /acts/:actorId/runs accepts `webhooks` URL param.
    webhook_encoded = requests.utils.quote(
        f'[{{"eventTypes":["ACTOR.RUN.SUCCEEDED"],"requestUrl":"{WEBHOOK_URL}"}}]'
    )
    start_url += f"&webhooks={webhook_encoded}"

    log.info("Starting actor %s ...", actor_id)
    resp = requests.post(start_url, json=payload, timeout=30)
    
    if not resp.ok:
        log.error("Failed to start actor: %s", resp.text)
        return
        
    run_id = resp.json()["data"]["id"]
    log.info("Started actor run %s. Webhook will process dataset.", run_id)

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    log.info("=" * 60)
    log.info("Job Dashboard Scraper (Async) — started at %s", datetime.utcnow().isoformat())
    log.info("=" * 60)

    if not APIFY_TOKEN or not SUPABASE_URL or not SUPABASE_KEY:
        log.error("Missing required environment variables. Exiting.")
        return

    # 1. Get configurations
    filters = get_user_filters()
    log.info("Found %d active user filters.", len(filters))

    # Aggregate by platform
    naukri_roles = set()
    indeed_tasks = []
    linkedin_tasks = []

    for f in filters:
        plat = f.get("platform_preference", "All")
        role = f.get("role_type")
        loc  = f.get("location", "Remote")
        if not role: continue
        
        if plat in ("All", "Naukri"):
            naukri_roles.add(role)
        if plat in ("All", "Indeed"):
            indeed_tasks.append({"role": role, "loc": loc})
        if plat in ("All", "LinkedIn"):
            linkedin_tasks.append({"role": role, "loc": loc})

    # 2. Dispatch Naukri (Bulk)
    if naukri_roles:
        start_apify_actor(
            actor_id=ACTORS["Naukri"],
            run_input={"desired_results": max(50, len(naukri_roles)*5)}
        )

    # 3. Dispatch LinkedIn
    # Use maxItems=10 cap to avoid heavy billing operations
    for task in linkedin_tasks:
        keyword = task["role"].replace(" ", "%20")
        url = (
            f"https://www.linkedin.com/jobs/search/"
            f"?keywords={keyword}&location={task['loc'].replace(' ', '%20')}&f_TPR=r86400"
        )
        start_apify_actor(
            actor_id=ACTORS["LinkedIn"],
            run_input={"urls": [url], "rows": 10, "scrapeCompany": False},
            max_items=10
        )

    # 4. Dispatch Indeed
    for task in indeed_tasks:
        start_apify_actor(
            actor_id=ACTORS["Indeed"],
            run_input={
                "country": "in",
                "title": task["role"],
                "location": task["loc"],
                "limit": 5,
                "datePosted": "1"
            }
        )

    log.info("=" * 60)
    log.info("Scraper orchestrator finished. Webhooks will handle dataload.")
    log.info("=" * 60)

if __name__ == "__main__":
    main()
