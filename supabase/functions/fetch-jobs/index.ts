import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APIFY_BASE = "https://api.apify.com/v2";
const LINKEDIN_ACTOR = "curious_coder~linkedin-jobs-scraper";
const POLL_INTERVAL = 5000; // ms
const MAX_WAIT = 300000; // 5 minutes in ms

interface ApifyJob {
  title?: string;
  companyName?: string;
  company?: string;
  location?: string;
  salaryInfo?: string | string[];
  salary?: string;
  link?: string;
  url?: string;
  descriptionText?: string;
  description?: string;
  experienceLevel?: string;
  [key: string]: unknown;
}

async function runApifyActor(
  actorId: string,
  runInput: Record<string, unknown>,
  maxItems: number,
  apifyToken: string
): Promise<ApifyJob[]> {
  // Start actor run
  const startUrl = `${APIFY_BASE}/acts/${actorId}/runs?token=${apifyToken}&maxItems=${maxItems}`;
  const startResp = await fetch(startUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(runInput),
  });

  if (!startResp.ok) {
    const err = await startResp.text();
    console.error("Apify start error:", err);
    throw new Error(`Apify actor start failed: ${startResp.status}`);
  }

  const startData = await startResp.json();
  const runId = startData.data.id;
  console.log(`Actor ${actorId} → run ${runId} started`);

  // Poll until complete
  const statusUrl = `${APIFY_BASE}/actor-runs/${runId}?token=${apifyToken}`;
  let elapsed = 0;
  let statusData;

  while (elapsed < MAX_WAIT) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    elapsed += POLL_INTERVAL;

    const statusResp = await fetch(statusUrl);
    statusData = await statusResp.json();
    const status = statusData.data.status;

    if (status === "SUCCEEDED") break;
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(status)) {
      console.warn(`Actor run ${runId} ended: ${status}`);
      return [];
    }
  }

  if (elapsed >= MAX_WAIT) {
    console.warn(`Actor run ${runId} timed out`);
    return [];
  }

  // Fetch dataset items
  const datasetId = statusData!.data.defaultDatasetId;
  const itemsUrl = `${APIFY_BASE}/datasets/${datasetId}/items?token=${apifyToken}&format=json&limit=${maxItems}`;
  const itemsResp = await fetch(itemsUrl);
  const items: ApifyJob[] = await itemsResp.json();
  console.log(`Actor ${actorId} → ${items.length} items fetched`);
  return items;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { session_id, job_titles } = await req.json();

    if (!session_id || !Array.isArray(job_titles) || job_titles.length === 0) {
      return new Response(
        JSON.stringify({ error: "session_id and job_titles are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apifyToken = Deno.env.get("APIFY_TOKEN")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get caller IP
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Budget guard: Check if this IP fetched in the last 6 hours
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: recentUsage } = await supabase
      .from("usage_log")
      .select("id, session_id")
      .eq("ip_address", ip)
      .gte("fetched_at", sixHoursAgo)
      .limit(1);

    if (recentUsage && recentUsage.length > 0) {
      // Return cached results from the most recent session for this IP
      const cachedSessionId = recentUsage[0].session_id;
      const { data: cachedJobs } = await supabase
        .from("ai_jobs")
        .select("*")
        .eq("session_id", cachedSessionId)
        .order("relevancy_score", { ascending: false, nullsFirst: false });

      console.log(`Rate limited — returning ${cachedJobs?.length || 0} cached jobs for IP ${ip}`);
      return new Response(
        JSON.stringify({
          jobs: cachedJobs || [],
          cached: true,
          message: "Results cached from a recent fetch. Try again later for fresh results.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch jobs from Apify for each title (3 per title = 15 total)
    const allJobs: Array<{
      session_id: string;
      title: string;
      company: string;
      location: string;
      salary: string;
      experience: string;
      jd_text: string;
      portal_url: string;
    }> = [];

    for (const jobTitle of job_titles.slice(0, 5)) {
      console.log(`Fetching LinkedIn jobs for: ${jobTitle}`);
      try {
        const keyword = encodeURIComponent(jobTitle);
        const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${keyword}&location=India&f_TPR=r86400`;

        const items = await runApifyActor(
          LINKEDIN_ACTOR,
          {
            urls: [searchUrl],
            rows: 3,
            scrapeCompany: false,
          },
          3,
          apifyToken
        );

        for (const item of items.slice(0, 3)) {
          const title = item.title || "";
          const company = item.companyName || item.company || "";
          if (!title || !company) continue;

          let salary = item.salaryInfo || item.salary || "";
          if (Array.isArray(salary)) {
            salary = salary.join(" - ");
          }

          allJobs.push({
            session_id,
            title,
            company,
            location: (item.location as string) || "",
            salary: String(salary),
            experience: (item.experienceLevel as string) || "",
            jd_text: ((item.descriptionText || item.description || "") as string).slice(0, 5000),
            portal_url: (item.link || item.url || "") as string,
          });
        }
      } catch (err) {
        console.error(`Failed to fetch jobs for "${jobTitle}":`, err);
      }
    }

    console.log(`Total jobs fetched: ${allJobs.length}`);

    // Store jobs in ai_jobs table
    if (allJobs.length > 0) {
      const { error: insertError } = await supabase.from("ai_jobs").insert(allJobs);

      if (insertError) {
        console.error("Failed to insert ai_jobs:", insertError);
        throw new Error("Failed to store fetched jobs");
      }
    }

    // Log usage
    await supabase.from("usage_log").insert({
      session_id,
      ip_address: ip,
    });

    // Fetch stored jobs with IDs
    const { data: storedJobs } = await supabase
      .from("ai_jobs")
      .select("*")
      .eq("session_id", session_id)
      .order("id", { ascending: true });

    return new Response(
      JSON.stringify({
        jobs: storedJobs || [],
        cached: false,
        message: `Fetched ${allJobs.length} fresh jobs.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("fetch-jobs error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
