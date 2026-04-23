import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const APIFY_BASE = "https://api.apify.com/v2";

const ACTORS: Record<string, string> = {
  "curious_coder~linkedin-jobs-scraper": "LinkedIn",
  "codemaverick~naukri-job-scraper-latest": "Naukri",
  "valig~indeed-jobs-scraper": "Indeed",
};

interface JobInput {
  title: string;
  company: string;
  location: string;
  url: string;
  platform: string;
  role_type?: string;
  salary: string;
  description: string;
  posted_date: string | null;
  dedup_key?: string;
  work_mode?: string;
  experience?: string;
  is_ghost?: boolean;
  apify_run_id?: string;
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function normalize(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

function makeDedupKey(title: string, company: string): string {
  return `${normalize(title)}|${normalize(company)}`;
}

function inferWorkMode(location: string, description: string): string | null {
  const combined = (location + " " + description).toLowerCase();
  if (/\bremote\b|\bwork from home\b|\bwfh\b|\btelecommute\b/.test(combined)) return "Remote";
  if (/\bhybrid\b|\bflex(ible)?\s*work\b/.test(combined)) return "Hybrid";
  if (/\bon-?site\b|\bonsite\b|\bin-?office\b|\boffice[- ]based\b/.test(combined)) return "On-site";
  return null;
}

function inferRoleType(title: string): string {
  const t = title.toLowerCase();
  const roleMap: Array<[RegExp, string]> = [
    [/\bdata engineer/, "Data Engineer"],
    [/\bdata analyst/, "Data Analyst"],
    [/\bdata scien/, "Data Scientist"],
    [/\bml engineer|\bmachine learning/, "ML Engineer"],
    [/\bfull[ -]?stack/, "Full Stack Developer"],
    [/\bfrontend|\bfront[ -]?end/, "Frontend Developer"],
    [/\bbackend|\bback[ -]?end/, "Backend Developer"],
    [/\bdevops/, "DevOps Engineer"],
    [/\bsre|\bsite reliability/, "SRE"],
    [/\bcloud/, "Cloud Engineer"],
    [/\bsoftware eng/, "Software Engineer"],
    [/\bproduct manager/, "Product Manager"],
    [/\bdesign/, "Designer"],
    [/\bqa|\bquality/, "QA Engineer"],
    [/\bsecurity/, "Security Engineer"],
    [/\bai engineer|\bartificial intelligence/, "AI Engineer"],
    [/\bplatform eng/, "Platform Engineer"],
  ];
  for (const [pattern, role] of roleMap) {
    if (pattern.test(t)) return role;
  }
  return "Other";
}

function inferExperience(description: string): string | null {
  if (!description) return null;
  const d = description.toLowerCase();
  // Match patterns like "3+ years", "3-5 years", "minimum 3 years"
  const match = d.match(/(\d+)\s*[\+\-]\s*(\d+)?\s*years?/);
  if (match) {
    return match[0];
  }
  // Match "X years of experience"
  const match2 = d.match(/(\d+)\s*years?\s*(of)?\s*experience/);
  if (match2) {
    return match2[0];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Ghost job detection — 5 signals
// ---------------------------------------------------------------------------

function detectGhostJob(
  job: JobInput,
  postedDate: string | null,
  allUrls: Set<string>
): boolean {
  let ghostSignals = 0;

  // Signal 1: Very old posting (>60 days)
  if (postedDate) {
    const posted = new Date(postedDate);
    const daysSincePosted = (Date.now() - posted.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSincePosted > 60) ghostSignals++;
  }

  // Signal 2: No description or very short description
  if (!job.description || job.description.trim().length < 100) {
    ghostSignals++;
  }

  // Signal 3: Generic/vague title
  const genericTitles = /\b(various|multiple|open|general|opportunity)\b/i;
  if (genericTitles.test(job.title)) {
    ghostSignals++;
  }

  // Signal 4: No salary and no location
  if (!job.salary && !job.location) {
    ghostSignals++;
  }

  // Signal 5: Description is mostly boilerplate (contains too many generic phrases)
  if (job.description) {
    const boilerplate = [
      "equal opportunity employer",
      "we are an equal",
      "drug-free workplace",
      "background check",
      "eeo/aa",
    ];
    const boilerplateCount = boilerplate.filter((bp) =>
      job.description.toLowerCase().includes(bp)
    ).length;
    // If description is mostly boilerplate (3+ matches) and short
    if (boilerplateCount >= 2 && job.description.length < 500) {
      ghostSignals++;
    }
  }

  // Ghost if 3+ signals
  return ghostSignals >= 3;
}

// ---------------------------------------------------------------------------
// Dataset mapping per platform
// ---------------------------------------------------------------------------

function parseDate(value: any): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];

  const str = String(value);
  const match = str.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return null;
}

function mapDatasetToJobs(platformName: string, items: any[]): JobInput[] {
  const jobs: JobInput[] = [];

  for (const item of items) {
    let title = "";
    let company = "";
    let location = "";
    let url = "";
    let salary = "";
    let description = "";
    let posted_date = null;

    if (platformName === "LinkedIn") {
      title = item.title || "";
      company = item.companyName || item.company || "";
      location = item.location || "";
      url = item.link || item.url || "";
      salary = item.salaryInfo || item.salary || "";
      if (Array.isArray(salary)) salary = salary.join(" - ");
      description = item.descriptionText || item.description || "";
      posted_date = parseDate(item.postedAt || item.publishedAt);
    } else if (platformName === "Naukri") {
      title = item["Job Title"] || item.title || item.jobTitle || "";
      company = item.Company || item.company || item.companyName || "";
      location = item.Location || item.location || "";
      url = item["Job URL"] || item.url || item.jdURL || "";
      salary = item.Salary || item.salary || "";
      description = item.Description || item.description || "";
      posted_date = parseDate(item["Posted Time"] || item.postedDate);
    } else if (platformName === "Indeed") {
      title = item.title || "";
      const emp = item.employer || {};
      company = emp.name || item.company || "";

      const loc = item.location || {};
      if (typeof loc === "object" && loc !== null) {
        const parts = [];
        if (loc.city) parts.push(loc.city);
        if (loc.countryName) parts.push(loc.countryName);
        location = parts.join(", ");
      } else {
        location = String(loc);
      }

      const sal = item.baseSalary || {};
      if (typeof sal === "object" && sal !== null && sal.min) {
        salary = `${sal.currencyCode || ""} ${sal.min}-${sal.max}/${sal.unitOfWork || ""}`.trim();
      } else {
        salary = item.salary || "";
      }

      const desc = item.description || {};
      description = desc.text || desc.html || String(desc);
      posted_date = parseDate(item.datePublished || item.dateOnIndeed);
    }

    if (!title || !company) continue;

    jobs.push({
      title,
      company,
      location,
      url,
      platform: platformName,
      salary: String(salary).slice(0, 50),
      description: description.slice(0, 2000),
      posted_date: posted_date || new Date().toISOString().split("T")[0],
    });
  }

  return jobs;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // We'll track this scan in scan_history
  let scanId: string | null = null;

  try {
    const payload = await req.json();
    console.log("Received Apify Webhook:", JSON.stringify(payload));

    const eventData = payload.eventData;
    if (!eventData || !eventData.datasetId || !eventData.actorId) {
      throw new Error("Missing datasetId or actorId in webhook payload");
    }

    const { datasetId, actorId } = eventData;
    const runId = eventData.actorRunId || null;

    // Reverse lookup the platform name
    let platformName = "Unknown";
    for (const [key, value] of Object.entries(ACTORS)) {
      if (actorId.includes(key)) {
        platformName = value;
        break;
      }
    }

    if (platformName === "Unknown") {
      console.warn(`Unmapped actorId: ${actorId}`);
      return new Response(JSON.stringify({ status: "ignored_actor" }), { status: 200 });
    }

    // --- Create scan_history record ---
    if (runId) {
      // Check if we already processed this run (dedup)
      const { data: existingScan } = await supabase
        .from("scan_history")
        .select("id, status")
        .eq("apify_run_id", runId)
        .single();

      if (existingScan && existingScan.status === "completed") {
        console.log(`Run ${runId} already processed — skipping`);
        return new Response(
          JSON.stringify({ status: "duplicate_run", scan_id: existingScan.id }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (existingScan) {
        scanId = existingScan.id;
      } else {
        const { data: newScan } = await supabase
          .from("scan_history")
          .insert({
            apify_run_id: runId,
            actor_id: actorId,
            platform: platformName,
            status: "running",
          })
          .select("id")
          .single();
        scanId = newScan?.id || null;
      }
    }

    // --- Fetch dataset from Apify ---
    const apifyToken = Deno.env.get("APIFY_TOKEN")!;
    if (!apifyToken) throw new Error("Missing APIFY_TOKEN in edge functions");

    const itemsUrl = `${APIFY_BASE}/datasets/${datasetId}/items?token=${apifyToken}&format=json`;
    const datasetRes = await fetch(itemsUrl);
    if (!datasetRes.ok) throw new Error(`Apify returned ${datasetRes.status}`);

    const items = await datasetRes.json();
    console.log(`Fetched ${items.length} items for ${platformName}`);

    // --- Map and normalize ---
    const parsedJobs = mapDatasetToJobs(platformName, items);

    // --- Dedup + enrich ---
    const allJobs: JobInput[] = [];
    const seenUrls = new Set<string>();
    const seenKeys = new Set<string>();
    let dedupCount = 0;

    for (const job of parsedJobs) {
      if (job.url && seenUrls.has(job.url)) { dedupCount++; continue; }
      if (job.url) seenUrls.add(job.url);

      const dedup_key = makeDedupKey(job.title, job.company);
      if (seenKeys.has(dedup_key)) { dedupCount++; continue; }
      seenKeys.add(dedup_key);

      // Enrich
      job.dedup_key = dedup_key;
      job.role_type = inferRoleType(job.title);
      job.work_mode = inferWorkMode(job.location, job.description);
      job.experience = inferExperience(job.description) || undefined;
      job.is_ghost = detectGhostJob(job, job.posted_date, seenUrls);
      if (runId) job.apify_run_id = runId;

      allJobs.push(job);
    }

    if (allJobs.length === 0) {
      // Update scan_history
      if (scanId) {
        await supabase
          .from("scan_history")
          .update({
            status: "completed",
            jobs_found: parsedJobs.length,
            jobs_inserted: 0,
            jobs_deduplicated: dedupCount,
            completed_at: new Date().toISOString(),
          })
          .eq("id", scanId);
      }
      return new Response(JSON.stringify({ status: "success", count: 0 }), { status: 200 });
    }

    // --- Upsert into Supabase ---
    let insertedCount = 0;
    for (let i = 0; i < allJobs.length; i += 50) {
      const batch = allJobs.slice(i, i + 50);
      const { error, count } = await supabase
        .from("jobs")
        .upsert(batch, { onConflict: "dedup_key", count: "exact" });

      if (error) {
        console.error("Upsert batch error:", error);
      } else {
        insertedCount += count || batch.length;
      }
    }

    const ghostCount = allJobs.filter((j) => j.is_ghost).length;
    console.log(
      `Upserted ${insertedCount} jobs (${ghostCount} flagged as ghost, ${dedupCount} deduped).`
    );

    // --- Update scan_history ---
    if (scanId) {
      await supabase
        .from("scan_history")
        .update({
          status: "completed",
          jobs_found: parsedJobs.length,
          jobs_inserted: insertedCount,
          jobs_deduplicated: dedupCount,
          completed_at: new Date().toISOString(),
        })
        .eq("id", scanId);
    }

    return new Response(
      JSON.stringify({
        status: "success",
        count: insertedCount,
        ghost_count: ghostCount,
        dedup_count: dedupCount,
        scan_id: scanId,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook processing error:", error);

    // Mark scan as failed
    if (scanId) {
      await supabase
        .from("scan_history")
        .update({
          status: "failed",
          error_message: String(error),
          completed_at: new Date().toISOString(),
        })
        .eq("id", scanId);
    }

    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
