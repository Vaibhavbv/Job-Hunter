import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function buildRewritePrompt(
  resumeText: string,
  jobTitle: string,
  jobCompany: string,
  jobDescription: string
): string {
  return `You are an expert resume writer and ATS optimization specialist.

TASK: Rewrite the resume below to maximize its match with the target job description.

RULES:
1. Keep ALL facts truthful — do not invent experience, skills, or accomplishments
2. Reframe bullet points to emphasize relevant skills and achievements
3. Reorder sections to put the most relevant experience first
4. Mirror keywords and phrases from the job description naturally
5. Use strong action verbs and quantify achievements where possible
6. Optimize for ATS (Applicant Tracking System) keyword matching
7. Keep the resume concise — aim for the same length as the original

ORIGINAL RESUME:
${resumeText.slice(0, 8000)}

TARGET JOB:
Title: ${jobTitle}
Company: ${jobCompany}
${jobDescription ? `\nDescription:\n${jobDescription.slice(0, 4000)}` : ""}

Return your response as a JSON object with these exact fields:
{
  "tailored_resume": "<the full rewritten resume as plain text>",
  "keywords_added": ["keyword1", "keyword2", ...],
  "ats_score": <estimated ATS match percentage 0-100>,
  "changes_summary": "<brief summary of key changes made>"
}

Return ONLY the JSON object, no markdown fences, no extra text.`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate the user via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { session_id, job_id, custom_jd, custom_title, custom_company } = await req.json();

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: "session_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Need either job_id or custom_jd
    if (!job_id && !custom_jd) {
      return new Response(
        JSON.stringify({ error: "Either job_id or custom_jd is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const geminiKey = Deno.env.get("GEMINI_API_KEY")!;

    // Initialize Supabase with the user's JWT to enforce RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch resume text — RLS ensures user can only access their own sessions
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

    let jobTitle = custom_title || "Target Role";
    let jobCompany = custom_company || "Target Company";
    let jobDescription = custom_jd || "";
    let resolvedJobId: number | null = null;

    // If job_id is provided, fetch from ai_jobs or jobs table
    if (job_id) {
      // Try ai_jobs first (backward compat)
      const { data: aiJob } = await supabase
        .from("ai_jobs")
        .select("*")
        .eq("id", job_id)
        .eq("session_id", session_id)
        .single();

      if (aiJob) {
        jobTitle = aiJob.title;
        jobCompany = aiJob.company;
        jobDescription = aiJob.jd_text || "";
      } else {
        // Try jobs table
        const { data: job } = await supabase
          .from("jobs")
          .select("id, title, company, description")
          .eq("id", job_id)
          .single();

        if (job) {
          jobTitle = job.title;
          jobCompany = job.company;
          jobDescription = job.description || "";
          resolvedJobId = job.id;
        } else {
          return new Response(
            JSON.stringify({ error: "Job not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Build prompt and call Gemini
    const prompt = buildRewritePrompt(session.resume_text, jobTitle, jobCompany, jobDescription);

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errBody = await geminiResponse.text();
      console.error("Gemini rewrite error:", geminiResponse.status, errBody);
      throw new Error(`Gemini API returned ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse structured response
    let tailoredResume = rawText;
    let keywordsAdded: string[] = [];
    let atsScore: number | null = null;
    let changesSummary = "";

    try {
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      tailoredResume = parsed.tailored_resume || rawText;
      keywordsAdded = Array.isArray(parsed.keywords_added) ? parsed.keywords_added : [];
      atsScore = typeof parsed.ats_score === "number" ? Math.min(100, Math.max(0, parsed.ats_score)) : null;
      changesSummary = parsed.changes_summary || "";
    } catch {
      // Gemini returned plain text — use as-is
      console.warn("Gemini returned non-JSON response, using raw text");
    }

    // Save to resumes table
    const { data: savedResume, error: saveError } = await supabase
      .from("resumes")
      .insert({
        user_id: user.id,
        job_id: resolvedJobId,
        session_id,
        original_text: session.resume_text.slice(0, 50000),
        tailored_text: tailoredResume.slice(0, 50000),
        keywords_added: keywordsAdded,
        ats_score: atsScore,
      })
      .select("id, ats_score, keywords_added, version")
      .single();

    if (saveError) {
      console.error("Failed to save tailored resume:", saveError);
      // Don't fail the request — still return the resume
    }

    return new Response(
      JSON.stringify({
        rewritten_resume: tailoredResume,
        resume_id: savedResume?.id || null,
        keywords_added: keywordsAdded,
        ats_score: atsScore,
        changes_summary: changesSummary,
        version: savedResume?.version || 1,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("rewrite-resume error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
