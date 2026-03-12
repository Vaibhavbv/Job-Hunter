"""
Job Dashboard Scraper
=====================
Scrapes jobs from LinkedIn, Naukri, and Indeed via Apify actors,
deduplicates results, and upserts to Supabase.

Runs daily via GitHub Actions cron at 8:00 AM IST (2:30 AM UTC).
"""

import os
import re
import time
import logging
from datetime import datetime, date

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

APIFY_TOKEN   = os.environ["APIFY_TOKEN"]
SUPABASE_URL  = os.environ["SUPABASE_URL"]
SUPABASE_KEY  = os.environ["SUPABASE_KEY"]

APIFY_BASE    = "https://api.apify.com/v2"

JOB_ROLES = [
    "Data Engineer",
    "Data Analyst",
    "Business Analyst",
    "Analytics Engineer",
    "ETL Developer",
    "BI Developer",
    "SQL Developer",
    "Python Developer",
    "Backend Engineer",
    "Product Analyst",
]

# Apify actor IDs
ACTORS = {
    "linkedin": "curious_coder~linkedin-jobs-scraper",
    "naukri":   "codemaverick~naukri-job-scraper-latest",
    "indeed":   "valig~indeed-jobs-scraper",
}

POLL_INTERVAL = 5   # seconds between status polls
MAX_WAIT      = 300  # max seconds to wait for an actor run

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def normalize(text: str) -> str:
    """Lowercase, strip non-alphanumeric chars, collapse whitespace."""
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s]", "", text)
    text = re.sub(r"\s+", " ", text)
    return text


def make_dedup_key(title: str, company: str) -> str:
    """Create a deduplication key from title and company."""
    return f"{normalize(title)}|{normalize(company)}"


def run_apify_actor(actor_id: str, run_input: dict) -> list:
    """
    Start an Apify actor, poll until finished, return dataset items.
    Returns an empty list on any failure.
    """
    # 1. Start the actor run
    start_url = f"{APIFY_BASE}/acts/{actor_id}/runs?token={APIFY_TOKEN}"
    resp = requests.post(start_url, json=run_input, timeout=30)
    resp.raise_for_status()
    run_data = resp.json()["data"]
    run_id   = run_data["id"]
    log.info("  Actor %s → run %s started", actor_id, run_id)

    # 2. Poll until SUCCEEDED / FAILED / timed out
    status_url = f"{APIFY_BASE}/actor-runs/{run_id}?token={APIFY_TOKEN}"
    elapsed = 0
    while elapsed < MAX_WAIT:
        time.sleep(POLL_INTERVAL)
        elapsed += POLL_INTERVAL
        status_resp = requests.get(status_url, timeout=30)
        status_resp.raise_for_status()
        status = status_resp.json()["data"]["status"]
        if status == "SUCCEEDED":
            break
        if status in ("FAILED", "ABORTED", "TIMED-OUT"):
            log.warning("  Actor %s run %s ended with status: %s", actor_id, run_id, status)
            return []
    else:
        log.warning("  Actor %s run %s timed out after %ds", actor_id, run_id, MAX_WAIT)
        return []

    # 3. Fetch dataset items
    dataset_id = status_resp.json()["data"]["defaultDatasetId"]
    items_url  = f"{APIFY_BASE}/datasets/{dataset_id}/items?token={APIFY_TOKEN}&format=json"
    items_resp = requests.get(items_url, timeout=30)
    items_resp.raise_for_status()
    items = items_resp.json()
    log.info("  Actor %s → %d items fetched", actor_id, len(items))
    return items


def parse_date(value) -> str | None:
    """Try to parse various date formats into YYYY-MM-DD string."""
    if not value:
        return None
    if isinstance(value, date):
        return value.isoformat()
    s = str(value).strip()
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%fZ",
                "%Y-%m-%dT%H:%M:%S%z", "%d-%m-%Y", "%d/%m/%Y", "%b %d, %Y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            pass
        # Fallback: try with truncated string for formats shorter than input
        try:
            return datetime.strptime(s[:len(fmt) + 5], fmt).date().isoformat()
        except (ValueError, IndexError):
            continue
    # Last resort: grab first 10 chars if they look like YYYY-MM-DD
    if len(s) >= 10 and re.match(r"\d{4}-\d{2}-\d{2}", s[:10]):
        return s[:10]
    return None


# ---------------------------------------------------------------------------
# Platform-specific scrapers
# ---------------------------------------------------------------------------

def scrape_linkedin(role: str) -> list[dict]:
    """Scrape LinkedIn jobs for a given role."""
    keyword = role.replace(" ", "%20")
    url = (
        f"https://www.linkedin.com/jobs/search/"
        f"?keywords={keyword}&location=Gurgaon%2C%20India&f_TPR=r86400"
    )
    run_input = {
        "urls": [url],
        "count": 5,
        "scrapeCompany": False,
    }
    items = run_apify_actor(ACTORS["linkedin"], run_input)
    jobs = []
    for item in items:
        title   = item.get("title") or item.get("jobTitle") or ""
        company = item.get("company") or item.get("companyName") or ""
        if not title or not company:
            continue
        jobs.append({
            "title":       title,
            "company":     company,
            "location":    item.get("location") or item.get("place") or "",
            "url":         item.get("url") or item.get("link") or item.get("jobUrl") or "",
            "platform":    "LinkedIn",
            "role_type":   role,
            "salary":      item.get("salary") or "",
            "description": (item.get("description") or "")[:2000],
            "posted_date": parse_date(item.get("postedDate") or item.get("publishedAt") or item.get("postedTime")),
        })
    return jobs


def scrape_naukri(role: str) -> list[dict]:
    """Scrape Naukri jobs for a given role, filtering by keyword."""
    run_input = {"desired_results": 5}
    items = run_apify_actor(ACTORS["naukri"], run_input)
    role_lower = role.lower()
    jobs = []
    for item in items:
        title = item.get("title") or item.get("jobTitle") or ""
        if role_lower not in title.lower():
            continue
        company = item.get("company") or item.get("companyName") or ""
        if not title or not company:
            continue
        # Resolve location safely — placeholders may be a list or absent
        placeholders = item.get("placeholders")
        if isinstance(placeholders, list) and len(placeholders) > 0:
            loc = item.get("location") or placeholders[0].get("value", "")
        else:
            loc = item.get("location", "")

        jobs.append({
            "title":       title,
            "company":     company,
            "location":    loc,
            "url":         item.get("url") or item.get("jdURL") or "",
            "platform":    "Naukri",
            "role_type":   role,
            "salary":      item.get("salary") or item.get("salaryText") or "",
            "description": (item.get("description") or item.get("jobDescription") or "")[:2000],
            "posted_date": parse_date(item.get("postedDate") or item.get("footerPlaceholderLabel") or item.get("createdDate")),
        })
    return jobs


def scrape_indeed(role: str) -> list[dict]:
    """Scrape Indeed jobs for a given role."""
    run_input = {
        "country": "in",
        "title": role,
        "location": "Gurgaon",
        "limit": 5,
        "datePosted": "1",
    }
    items = run_apify_actor(ACTORS["indeed"], run_input)
    jobs = []
    for item in items:
        title   = item.get("title") or item.get("positionName") or ""
        company = item.get("company") or item.get("companyName") or ""
        if not title or not company:
            continue
        jobs.append({
            "title":       title,
            "company":     company,
            "location":    item.get("location") or "",
            "url":         item.get("url") or item.get("externalApplyLink") or "",
            "platform":    "Indeed",
            "role_type":   role,
            "salary":      item.get("salary") or "",
            "description": (item.get("description") or "")[:2000],
            "posted_date": parse_date(item.get("postedDate") or item.get("postedAt") or item.get("date")),
        })
    return jobs


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def supabase_upsert(rows: list[dict]):
    """
    Upsert rows into the 'jobs' table via Supabase REST API (PostgREST).
    Uses the Prefer header for merge-duplicates on the dedup_key column.
    """
    url = f"{SUPABASE_URL}/rest/v1/jobs?on_conflict=dedup_key"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    resp = requests.post(url, json=rows, headers=headers, timeout=30)
    resp.raise_for_status()


def main():
    log.info("=" * 60)
    log.info("Job Dashboard Scraper — started at %s", datetime.utcnow().isoformat())
    log.info("=" * 60)

    all_jobs: list[dict] = []
    seen_urls: set[str]  = set()      # Layer 1: within-platform dedup by URL
    seen_keys: set[str]  = set()      # Layer 2: cross-platform dedup by title|company

    scrapers = {
        "LinkedIn": scrape_linkedin,
        "Naukri":   scrape_naukri,
        "Indeed":   scrape_indeed,
    }

    for role in JOB_ROLES:
        log.info("--- Role: %s ---", role)
        for platform_name, scraper_fn in scrapers.items():
            try:
                log.info("  Scraping %s …", platform_name)
                jobs = scraper_fn(role)
                log.info("  %s returned %d jobs for %s", platform_name, len(jobs), role)

                for job in jobs:
                    # Layer 1: deduplicate by URL within this run
                    url = job.get("url", "")
                    if url and url in seen_urls:
                        continue
                    if url:
                        seen_urls.add(url)

                    # Layer 2: deduplicate by normalized title|company
                    dedup_key = make_dedup_key(job["title"], job["company"])
                    if dedup_key in seen_keys:
                        continue
                    seen_keys.add(dedup_key)

                    job["dedup_key"] = dedup_key

                    # Default posted_date to today if missing
                    if not job.get("posted_date"):
                        job["posted_date"] = date.today().isoformat()

                    all_jobs.append(job)

            except Exception:
                log.exception(
                    "  ✗ Failed scraping %s for role '%s' — skipping",
                    platform_name, role,
                )

    log.info("=" * 60)
    log.info("Total unique jobs after dedup: %d", len(all_jobs))

    # Layer 3: upsert to Supabase via REST API (dedup_key is UNIQUE,
    # so duplicates are handled automatically via merge-duplicates)
    if all_jobs:
        batch_size = 50
        for i in range(0, len(all_jobs), batch_size):
            batch = all_jobs[i : i + batch_size]
            try:
                supabase_upsert(batch)
                log.info("  Upserted batch %d–%d", i + 1, min(i + batch_size, len(all_jobs)))
            except Exception:
                log.exception("  ✗ Failed to upsert batch %d–%d", i + 1, min(i + batch_size, len(all_jobs)))

    log.info("=" * 60)
    log.info("Scraper finished at %s", datetime.utcnow().isoformat())
    log.info("=" * 60)


if __name__ == "__main__":
    main()
