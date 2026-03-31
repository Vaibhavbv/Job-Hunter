import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface AiJob {
  id: number;
  title: string;
  company: string;
  jd_text: string;
  salary: string;
  experience: string;
  [key: string]: unknown;
}

interface ScoreResult {
  relevancy_score: number;
  salary_match: string;
  experience_match: boolean;
  top_3_reasons: string[];
  one_line_summary: string;
}

async function scoreJobBatch(
  resumeText: string,
  jobs: AiJob[],
  geminiKey: string
): Promise<Map<number, ScoreResult>> {
  const jobDescriptions = jobs
    .map(
      (j, i) =>
        `--- JOB ${i + 1} (ID: ${j.id}) ---\nTitle: ${j.title}\nCompany: ${j.company}\nSalary: ${j.salary || "Not listed"}\nExperience: ${j.experience || "Not listed"}\nDescription: ${(j.jd_text || "No description available").slice(0, 2000)}`
    )
    .join("\n\n");

  const prompt = `Given this resume text and these job descriptions, score each job for relevancy.

RESUME:
${resumeText.slice(0, 6000)}

JOBS:
${jobDescriptions}

For EACH job, return a JSON array of objects (one per job, same order) with these fields:
- job_id (number): the ID from the job header
- relevancy_score (number 0-100): how well the candidate matches this job
- salary_match (string): "true", "false", or "unknown"
- experience_match (boolean): true if candidate's experience level matches
- top_3_reasons (array of 3 strings): why this job is/isn't a good match
- one_line_summary (string): one sentence summary of the match

Return ONLY the JSON array, nothing else.`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini scoring error:", response.status, errText);
    throw new Error(`Gemini API returned ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

  const results = new Map<number, ScoreResult>();

  try {
    // Try to parse the JSON — handle markdown code fences if present
    const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        results.set(item.job_id, {
          relevancy_score: Math.min(100, Math.max(0, Number(item.relevancy_score) || 0)),
          salary_match: String(item.salary_match || "unknown"),
          experience_match: Boolean(item.experience_match),
          top_3_reasons: Array.isArray(item.top_3_reasons)
            ? item.top_3_reasons.slice(0, 3).map(String)
            : [],
          one_line_summary: String(item.one_line_summary || ""),
        });
      }
    }
  } catch (e) {
    console.error("Failed to parse scoring response:", e, rawText.slice(0, 500));
  }

  return results;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { session_id } = await req.json();

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: "session_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiKey = Deno.env.get("GEMINI_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch session resume text
    const { data: session, error: sessionError } = await supabase
      .from("user_sessions")
      .select("resume_text")
      .eq("id", session_id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch unscored jobs for this session
    const { data: jobs, error: jobsError } = await supabase
      .from("ai_jobs")
      .select("*")
      .eq("session_id", session_id)
      .is("relevancy_score", null);

    if (jobsError) {
      throw new Error("Failed to fetch jobs");
    }

    if (!jobs || jobs.length === 0) {
      // Return already-scored jobs
      const { data: scoredJobs } = await supabase
        .from("ai_jobs")
        .select("*")
        .eq("session_id", session_id)
        .order("relevancy_score", { ascending: false });

      return new Response(
        JSON.stringify({ jobs: scoredJobs || [], message: "All jobs already scored" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Batch jobs (5 at a time) to save tokens
    const BATCH_SIZE = 5;
    for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
      const batch = jobs.slice(i, i + BATCH_SIZE);
      console.log(`Scoring batch ${i / BATCH_SIZE + 1}: ${batch.length} jobs`);

      try {
        const scores = await scoreJobBatch(session.resume_text, batch, geminiKey);

        // Update each job with its score
        for (const job of batch) {
          const score = scores.get(job.id);
          if (score) {
            await supabase
              .from("ai_jobs")
              .update({
                relevancy_score: score.relevancy_score,
                salary_match: score.salary_match,
                experience_match: score.experience_match,
                reasons: score.top_3_reasons,
                summary: score.one_line_summary,
              })
              .eq("id", job.id);
          }
        }
      } catch (err) {
        console.error(`Batch ${i / BATCH_SIZE + 1} scoring failed:`, err);
      }
    }

    // Return all scored jobs
    const { data: finalJobs } = await supabase
      .from("ai_jobs")
      .select("*")
      .eq("session_id", session_id)
      .order("relevancy_score", { ascending: false, nullsFirst: false });

    return new Response(
      JSON.stringify({ jobs: finalJobs || [], message: "Scoring complete" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("score-jobs error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
