import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const APIFY_BASE = "https://api.apify.com/v2";

const ACTORS = {
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
}

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
  if (/\bremote\b|\bwork from home\b|\bwfh\b/.test(combined)) return "Remote";
  if (/\bhybrid\b/.test(combined)) return "Hybrid";
  if (/\bon-?site\b|\bonsite\b|\bin-?office\b/.test(combined)) return "On-site";
  return null;
}

function inferRoleType(title: string): string {
  const t = title.toLowerCase();
  const roleMap: Array<[RegExp, string]> = [
    [/\bdata engineer/,    "Data Engineer"],
    [/\bdata analyst/,     "Data Analyst"],
    [/\bdata scien/,       "Data Scientist"],
    [/\bml engineer|\bmachine learning/,   "ML Engineer"],
    [/\bfull[ -]?stack/,   "Full Stack Developer"],
    [/\bfrontend|\bfront[ -]?end/,  "Frontend Developer"],
    [/\bbackend|\bback[ -]?end/,    "Backend Developer"],
    [/\bdevops/,           "DevOps Engineer"],
    [/\bsre|\bsite reliability/,    "SRE"],
    [/\bcloud/,            "Cloud Engineer"],
    [/\bsoftware eng/,     "Software Engineer"],
    [/\bproduct manager/,  "Product Manager"],
    [/\bdesign/,           "Designer"],
    [/\bqa|\bquality/,     "QA Engineer"],
    [/\bsecurity/,         "Security Engineer"],
  ];
  for (const [pattern, role] of roleMap) {
    if (pattern.test(t)) return role;
  }
  return "Other";
}

function parseDate(value: any): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  
  // Try fallback logic for DD-MM-YYYY or DD/MM/YYYY
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
    } 
    else if (platformName === "Naukri") {
      title = item["Job Title"] || item.title || item.jobTitle || "";
      company = item.Company || item.company || item.companyName || "";
      location = item.Location || item.location || "";
      url = item["Job URL"] || item.url || item.jdURL || "";
      salary = item.Salary || item.salary || "";
      description = item.Description || item.description || "";
      posted_date = parseDate(item["Posted Time"] || item.postedDate);
    } 
    else if (platformName === "Indeed") {
      title = item.title || "";
      const emp = item.employer || {};
      company = emp.name || item.company || "";
      
      const loc = item.location || {};
      if (typeof loc === "object" && loc !== null) {
        let parts = [];
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

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    console.log("Received Apify Webhook:", JSON.stringify(payload));

    const eventData = payload.eventData;
    if (!eventData || !eventData.datasetId || !eventData.actorId) {
      throw new Error("Missing datasetId or actorId in webhook payload");
    }

    const { datasetId, actorId } = eventData;
    
    // Reverse lookup the platform name from the actor string (could be partial match)
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

    const apifyToken = Deno.env.get("APIFY_TOKEN")!;
    if (!apifyToken) throw new Error("Missing APIFY_TOKEN in edge functions");

    // Fetch dataset from Apify 
    const itemsUrl = `${APIFY_BASE}/datasets/${datasetId}/items?token=${apifyToken}&format=json`;
    const datasetRes = await fetch(itemsUrl);
    if (!datasetRes.ok) throw new Error(`Apify returned ${datasetRes.status}`);
    
    const items = await datasetRes.json();
    console.log(`Fetched ${items.length} items for ${platformName}`);

    // Map and normalize
    const parsedJobs = mapDatasetToJobs(platformName, items);

    // Dedup processing limits
    const allJobs: JobInput[] = [];
    const seenUrls = new Set<string>();
    const seenKeys = new Set<string>();

    for (const job of parsedJobs) {
      if (job.url && seenUrls.has(job.url)) continue;
      if (job.url) seenUrls.add(job.url);

      const dedup_key = makeDedupKey(job.title, job.company);
      if (seenKeys.has(dedup_key)) continue;
      seenKeys.add(dedup_key);

      job.dedup_key = dedup_key;
      job.role_type = inferRoleType(job.title);
      (job as any).work_mode = inferWorkMode(job.location, job.description);
      allJobs.push(job);
    }

    if (allJobs.length === 0) {
      return new Response(JSON.stringify({ status: "success", count: 0 }), { status: 200 });
    }

    // Upsert into Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create chunks of 50 to avoid payload caps
    for (let i = 0; i < allJobs.length; i += 50) {
       let batch = allJobs.slice(i, i + 50);
       const { error } = await supabase
         .from("jobs")
         .upsert(batch, { onConflict: "dedup_key" });
         
       if (error) console.error("Upsert batch error:", error);
    }

    console.log(`Upserted ${allJobs.length} jobs to DB.`);
    return new Response(JSON.stringify({ status: "success", count: allJobs.length }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
