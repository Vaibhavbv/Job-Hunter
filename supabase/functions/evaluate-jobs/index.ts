import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------------------------------------------------------------------------
// Evaluation constants
// ---------------------------------------------------------------------------

const DIMENSION_WEIGHTS: Record<string, number> = {
  technical_fit: 0.35,
  seniority_fit: 0.25,
  domain_fit: 0.20,
  salary_fit: 0.10,
  location_fit: 0.10,
};

const GATE_FAIL_THRESHOLD = 20; // any dimension below this = gate fail
const BATCH_SIZE = 5;

function computeGrade(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  if (score >= 40) return "D";
  return "F";
}

function computeArchetype(grade: string, gateFail: string | null): string {
  if (gateFail) return "Dealbreaker";
  if (grade === "A+") return "Dream Job";
  if (grade === "A") return "Strong Match";
  if (grade === "B+" || grade === "B") return "Worth Trying";
  if (grade === "C") return "Stretch";
  return "Mismatch";
}

function computeRecommendation(grade: string, gateFail: string | null): string {
  if (gateFail) return "Skip";
  if (grade === "A+" || grade === "A") return "Apply Now";
  if (grade === "B+" || grade === "B") return "Worth Trying";
  if (grade === "C") return "Maybe Later";
  return "Skip";
}

// ---------------------------------------------------------------------------
// Gemini API call
// ---------------------------------------------------------------------------

interface DimensionScores {
  job_id: number;
  technical_fit: number;
  seniority_fit: number;
  domain_fit: number;
  salary_fit: number;
  location_fit: number;
  reasons: string[];
  risks: string[];
  summary: string;
}

interface JobRow {
  id: number;
  title: string;
  company: string;
  description: string;
  salary: string;
  location: string;
  work_mode: string;
  experience: string;
}

interface UserProfile {
  base_resume: string;
  skills: string[];
  preferred_roles: string[];
  min_salary: number | null;
  preferred_locations: string[];
  experience_years: number | null;
  headline: string | null;
}

function buildEvaluationPrompt(profile: UserProfile, jobs: JobRow[]): string {
  const jobDescriptions = jobs
    .map(
      (j, i) =>
        `--- JOB ${i + 1} (ID: ${j.id}) ---
Title: ${j.title}
Company: ${j.company}
Location: ${j.location || "Not listed"}
Work Mode: ${j.work_mode || "Unknown"}
Salary: ${j.salary || "Not listed"}
Experience Required: ${j.experience || "Not listed"}
Description:
${(j.description || "No description").slice(0, 2000)}`
    )
    .join("\n\n");

  const profileContext = `
CANDIDATE PROFILE:
${profile.headline ? `Headline: ${profile.headline}` : ""}
${profile.experience_years ? `Years of Experience: ${profile.experience_years}` : ""}
${profile.skills?.length ? `Key Skills: ${profile.skills.join(", ")}` : ""}
${profile.preferred_roles?.length ? `Target Roles: ${profile.preferred_roles.join(", ")}` : ""}
${profile.min_salary ? `Minimum Salary: ${profile.min_salary}` : ""}
${profile.preferred_locations?.length ? `Preferred Locations: ${profile.preferred_locations.join(", ")}` : ""}

RESUME:
${(profile.base_resume || "").slice(0, 6000)}`.trim();

  return `You are an expert career advisor. Evaluate how well each job matches this candidate across 5 dimensions.

${profileContext}

JOBS TO EVALUATE:
${jobDescriptions}

For EACH job, score these 5 dimensions (0-100):
1. technical_fit — How well do the candidate's technical skills match the job requirements?
2. seniority_fit — Does the candidate's experience level match what's expected?
3. domain_fit — How relevant is the candidate's industry/domain experience?
4. salary_fit — Does the expected compensation align? (50 if unknown)
5. location_fit — Does the job's location/work-mode match preferences? (50 if unknown)

Also provide for each job:
- reasons: exactly 3 short strings explaining why this is/isn't a good fit
- risks: exactly 2 short strings about potential concerns
- summary: one sentence overall assessment

Return ONLY a JSON array (one object per job, same order) with these exact fields:
[
  {
    "job_id": <number>,
    "technical_fit": <0-100>,
    "seniority_fit": <0-100>,
    "domain_fit": <0-100>,
    "salary_fit": <0-100>,
    "location_fit": <0-100>,
    "reasons": ["...", "...", "..."],
    "risks": ["...", "..."],
    "summary": "..."
  }
]

Return ONLY the JSON array, no markdown fences, no extra text.`;
}

async function callGemini(prompt: string, geminiKey: string): Promise<DimensionScores[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini evaluation error:", response.status, errText);
    throw new Error(`Gemini API returned ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
  const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error("Expected array");
    return parsed.map((item: any) => ({
      job_id: Number(item.job_id),
      technical_fit: clamp(item.technical_fit),
      seniority_fit: clamp(item.seniority_fit),
      domain_fit: clamp(item.domain_fit),
      salary_fit: clamp(item.salary_fit),
      location_fit: clamp(item.location_fit),
      reasons: Array.isArray(item.reasons) ? item.reasons.slice(0, 3).map(String) : [],
      risks: Array.isArray(item.risks) ? item.risks.slice(0, 3).map(String) : [],
      summary: String(item.summary || ""),
    }));
  } catch (e) {
    console.error("Failed to parse evaluation response:", e, cleaned.slice(0, 500));
    return [];
  }
}

function clamp(v: unknown): number {
  const n = Number(v) || 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const jobIds: number[] = body.job_ids; // specific jobs to evaluate
    const sessionId: string | undefined = body.session_id; // optional: for backward compat

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const geminiKey = Deno.env.get("GEMINI_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Fetch user profile for evaluation context ---
    const { data: profile } = await supabase
      .from("profiles")
      .select("base_resume, skills, preferred_roles, min_salary, preferred_locations, experience_years, headline")
      .eq("id", user.id)
      .single();

    // If no base_resume in profile, try the latest session
    let resumeText = profile?.base_resume || "";
    if (!resumeText && sessionId) {
      const { data: session } = await supabase
        .from("user_sessions")
        .select("resume_text")
        .eq("id", sessionId)
        .single();
      resumeText = session?.resume_text || "";
    }
    if (!resumeText) {
      // Fallback: grab the latest session for this user
      const { data: latestSession } = await supabase
        .from("user_sessions")
        .select("resume_text")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      resumeText = latestSession?.resume_text || "";
    }

    if (!resumeText) {
      return new Response(
        JSON.stringify({ error: "No resume found. Please upload a resume first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userProfile: UserProfile = {
      base_resume: resumeText,
      skills: profile?.skills || [],
      preferred_roles: profile?.preferred_roles || [],
      min_salary: profile?.min_salary || null,
      preferred_locations: profile?.preferred_locations || [],
      experience_years: profile?.experience_years || null,
      headline: profile?.headline || null,
    };

    // --- Fetch jobs to evaluate ---
    let jobsQuery = supabase
      .from("jobs")
      .select("id, title, company, description, salary, location, work_mode, experience");

    if (jobIds && jobIds.length > 0) {
      jobsQuery = jobsQuery.in("id", jobIds);
    } else {
      // Default: evaluate recently scraped jobs that haven't been evaluated yet
      const { data: existingEvalIds } = await supabase
        .from("evaluations")
        .select("job_id");

      const evaluatedIds = (existingEvalIds || []).map((e: any) => e.job_id);

      jobsQuery = jobsQuery
        .eq("status", "active")
        .eq("is_ghost", false)
        .order("created_at", { ascending: false })
        .limit(20);

      // We'll filter out already-evaluated jobs after fetch
      if (evaluatedIds.length > 0) {
        // Supabase doesn't support NOT IN directly, so we filter client-side
      }
    }

    const { data: jobs, error: jobsError } = await jobsQuery;
    if (jobsError) throw new Error(`Failed to fetch jobs: ${jobsError.message}`);

    // Filter out already-evaluated jobs (unless specific IDs were requested)
    let jobsToEvaluate: JobRow[] = jobs || [];
    if (!jobIds || jobIds.length === 0) {
      const { data: existingEvals } = await supabase
        .from("evaluations")
        .select("job_id");
      const evaluatedSet = new Set((existingEvals || []).map((e: any) => e.job_id));
      jobsToEvaluate = jobsToEvaluate.filter((j) => !evaluatedSet.has(j.id));
    }

    if (jobsToEvaluate.length === 0) {
      // Return existing evaluations
      const { data: existingEvaluations } = await supabase
        .from("evaluations")
        .select("*")
        .order("overall_score", { ascending: false });

      return new Response(
        JSON.stringify({
          evaluations: existingEvaluations || [],
          new_count: 0,
          message: "All jobs already evaluated.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Batch evaluate ---
    const allEvaluations: any[] = [];

    for (let i = 0; i < jobsToEvaluate.length; i += BATCH_SIZE) {
      const batch = jobsToEvaluate.slice(i, i + BATCH_SIZE);
      console.log(`Evaluating batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} jobs`);

      try {
        const prompt = buildEvaluationPrompt(userProfile, batch);
        const scores = await callGemini(prompt, geminiKey);

        for (const job of batch) {
          const score = scores.find((s) => s.job_id === job.id);
          if (!score) continue;

          // Compute weighted overall score
          const overall = Math.round(
            score.technical_fit * DIMENSION_WEIGHTS.technical_fit +
            score.seniority_fit * DIMENSION_WEIGHTS.seniority_fit +
            score.domain_fit * DIMENSION_WEIGHTS.domain_fit +
            score.salary_fit * DIMENSION_WEIGHTS.salary_fit +
            score.location_fit * DIMENSION_WEIGHTS.location_fit
          );

          // Gate-fail check
          const dimensions: Record<string, number> = {
            technical_fit: score.technical_fit,
            seniority_fit: score.seniority_fit,
            domain_fit: score.domain_fit,
            salary_fit: score.salary_fit,
            location_fit: score.location_fit,
          };
          let gateFail: string | null = null;
          for (const [dim, val] of Object.entries(dimensions)) {
            if (val < GATE_FAIL_THRESHOLD) {
              gateFail = dim;
              break;
            }
          }

          const grade = computeGrade(overall);
          const archetype = computeArchetype(grade, gateFail);
          const recommendation = computeRecommendation(grade, gateFail);

          const evaluation = {
            user_id: user.id,
            job_id: job.id,
            session_id: sessionId || null,
            technical_fit: score.technical_fit,
            seniority_fit: score.seniority_fit,
            domain_fit: score.domain_fit,
            salary_fit: score.salary_fit,
            location_fit: score.location_fit,
            overall_score: overall,
            grade,
            archetype,
            gate_fail: gateFail,
            recommendation,
            reasons: score.reasons,
            risks: score.risks,
            summary: score.summary,
            model_used: "gemini-2.5-flash",
          };

          allEvaluations.push(evaluation);
        }
      } catch (err) {
        console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} evaluation failed:`, err);
      }
    }

    // --- Upsert evaluations ---
    if (allEvaluations.length > 0) {
      const { error: upsertError } = await supabase
        .from("evaluations")
        .upsert(allEvaluations, { onConflict: "user_id,job_id" });

      if (upsertError) {
        console.error("Failed to upsert evaluations:", upsertError);
        throw new Error("Failed to save evaluations");
      }
    }

    // Return all evaluations for this user
    const { data: finalEvaluations } = await supabase
      .from("evaluations")
      .select("*")
      .order("overall_score", { ascending: false });

    return new Response(
      JSON.stringify({
        evaluations: finalEvaluations || [],
        new_count: allEvaluations.length,
        message: `Evaluated ${allEvaluations.length} new jobs.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("evaluate-jobs error:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
