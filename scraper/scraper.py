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

# LinkedIn actor ignores result-count limits and scrapes ALL matches
# (~100-500 per role). To control cost, only use the 3 highest-priority
# roles for LinkedIn. Indeed + Naukri cover the rest cheaply.
LINKEDIN_ROLES = [
    "Data Engineer",
    "Data Analyst",
    "Business Analyst",
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
    """Scrape LinkedIn jobs for a given role. Limited to 5 results."""
    keyword = role.replace(" ", "%20")
    url = (
        f"https://www.linkedin.com/jobs/search/"
        f"?keywords={keyword}&location=Gurgaon%2C%20India&f_TPR=r86400"
    )
    run_input = {
        "urls": [url],
        "rows": 5,
        "scrapeCompany": False,
    }
    items = run_apify_actor(ACTORS["linkedin"], run_input)
    # Hard-cap to 5 in case the actor ignores the limit
    items = items[:5]
    if items:
        log.info("    LinkedIn sample keys: %s", list(items[0].keys())[:10])
    jobs = []
    for item in items:
        title   = item.get("title") or ""
        company = item.get("companyName") or item.get("company") or ""
        if not title or not company:
            continue
        salary_raw = item.get("salaryInfo") or item.get("salary") or ""
        if isinstance(salary_raw, list):
            salary_raw = " - ".join(str(s) for s in salary_raw)
        jobs.append({
            "title":       title,
            "company":     company,
            "location":    item.get("location") or "",
            "url":         item.get("link") or item.get("url") or "",
            "platform":    "LinkedIn",
            "role_type":   role,
            "salary":      str(salary_raw),
            "description": (item.get("descriptionText") or item.get("description") or "")[:2000],
            "posted_date": parse_date(item.get("postedAt") or item.get("publishedAt")),
        })
    return jobs


def scrape_naukri_bulk(roles: list[str]) -> list[dict]:
    """
    Scrape Naukri jobs ONCE with a larger batch, then filter for all roles.
    This avoids calling the actor 10 times (once per role).
    """
    run_input = {"desired_results": 50}
    log.info("  Scraping Naukri (single bulk call for all roles) …")
    items = run_apify_actor(ACTORS["naukri"], run_input)
    if items:
        log.info("    Naukri sample keys: %s", list(items[0].keys()))
    log.info("    Naukri returned %d raw items", len(items))

    roles_lower = {r.lower(): r for r in roles}
    jobs = []
    for item in items:
        title = item.get("Job Title") or item.get("title") or item.get("jobTitle") or ""
        company = item.get("Company") or item.get("company") or item.get("companyName") or ""
        if not title or not company:
            continue

        # Match against any of the target roles
        matched_role = None
        title_lower = title.lower()
        for role_lower, role_original in roles_lower.items():
            if role_lower in title_lower:
                matched_role = role_original
                break
        if not matched_role:
            continue

        jobs.append({
            "title":       title,
            "company":     company,
            "location":    item.get("Location") or item.get("location") or "",
            "url":         item.get("Job URL") or item.get("url") or item.get("jdURL") or "",
            "platform":    "Naukri",
            "role_type":   matched_role,
            "salary":      item.get("Salary") or item.get("salary") or "",
            "description": (item.get("Description") or item.get("description") or "")[:2000],
            "posted_date": parse_date(item.get("Posted Time") or item.get("postedDate")),
        })
    log.info("    Naukri matched %d jobs across all roles", len(jobs))
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
    if items:
        log.info("    Indeed sample keys: %s", list(items[0].keys())[:10])
    jobs = []
    for item in items:
        title = item.get("title") or ""
        employer = item.get("employer") or {}
        company  = employer.get("name") or item.get("company") or ""
        if not title or not company:
            continue

        loc_raw = item.get("location") or {}
        if isinstance(loc_raw, dict):
            city    = loc_raw.get("city") or ""
            country = loc_raw.get("countryName") or ""
            location_str = f"{city}, {country}".strip(", ") if city or country else ""
        else:
            location_str = str(loc_raw)

        base_salary = item.get("baseSalary") or {}
        if isinstance(base_salary, dict) and base_salary.get("min"):
            sal_min  = base_salary.get("min", "")
            sal_max  = base_salary.get("max", "")
            sal_unit = base_salary.get("unitOfWork", "")
            sal_curr = base_salary.get("currencyCode", "")
            salary_str = f"{sal_curr} {sal_min}-{sal_max}/{sal_unit}".strip()
        else:
            salary_str = item.get("salary") or ""

        desc_raw = item.get("description") or {}
        if isinstance(desc_raw, dict):
            description = desc_raw.get("text") or desc_raw.get("html") or ""
        else:
            description = str(desc_raw)

        jobs.append({
            "title":       title,
            "company":     company,
            "location":    location_str,
            "url":         item.get("url") or item.get("jobUrl") or "",
            "platform":    "Indeed",
            "role_type":   role,
            "salary":      salary_str,
            "description": description[:2000],
            "posted_date": parse_date(item.get("datePublished") or item.get("dateOnIndeed")),
        })
    return jobs


# ---------------------------------------------------------------------------
# Dedup helper
# ---------------------------------------------------------------------------

def deduplicate_and_collect(jobs: list[dict], all_jobs: list[dict],
                            seen_urls: set, seen_keys: set):
    """Apply Layer 1 + Layer 2 dedup and add unique jobs to all_jobs."""
    added = 0
    for job in jobs:
        url = job.get("url", "")
        if url and url in seen_urls:
            continue
        if url:
            seen_urls.add(url)

        dedup_key = make_dedup_key(job["title"], job["company"])
        if dedup_key in seen_keys:
            continue
        seen_keys.add(dedup_key)

        job["dedup_key"] = dedup_key
        if not job.get("posted_date"):
            job["posted_date"] = date.today().isoformat()

        all_jobs.append(job)
        added += 1
    return added


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
    seen_urls: set[str]  = set()
    seen_keys: set[str]  = set()

    # ------------------------------------------------------------------
    # 1. Naukri — single bulk call for all roles (saves 9 actor runs!)
    # ------------------------------------------------------------------
    try:
        naukri_jobs = scrape_naukri_bulk(JOB_ROLES)
        added = deduplicate_and_collect(naukri_jobs, all_jobs, seen_urls, seen_keys)
        log.info("  Naukri: %d unique jobs added", added)
    except Exception:
        log.exception("  ✗ Failed scraping Naukri — skipping")

    # ------------------------------------------------------------------
    # 2. LinkedIn (3 key roles) + Indeed (all 10 roles)
    # ------------------------------------------------------------------
    for role in JOB_ROLES:
        log.info("--- Role: %s ---", role)

        # LinkedIn — only for high-priority roles (actor is expensive)
        if role in LINKEDIN_ROLES:
            try:
                log.info("  Scraping LinkedIn …")
                jobs = scrape_linkedin(role)
                log.info("  LinkedIn returned %d jobs for %s", len(jobs), role)
                added = deduplicate_and_collect(jobs, all_jobs, seen_urls, seen_keys)
                log.info("  LinkedIn: %d unique added", added)
            except Exception:
                log.exception("  ✗ Failed scraping LinkedIn for role '%s' — skipping", role)
        else:
            log.info("  Skipping LinkedIn for '%s' (cost control)", role)

        # Indeed — all roles (cheap, pay-per-result, respects limits)
        try:
            log.info("  Scraping Indeed …")
            jobs = scrape_indeed(role)
            log.info("  Indeed returned %d jobs for %s", len(jobs), role)
            added = deduplicate_and_collect(jobs, all_jobs, seen_urls, seen_keys)
            log.info("  Indeed: %d unique added", added)
        except Exception:
            log.exception("  ✗ Failed scraping Indeed for role '%s' — skipping", role)

    log.info("=" * 60)
    log.info("Total unique jobs after dedup: %d", len(all_jobs))

    # Layer 3: upsert to Supabase via REST API
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
