import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { session_id, job_id } = await req.json();

    if (!session_id || !job_id) {
      return new Response(
        JSON.stringify({ error: "session_id and job_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiKey = Deno.env.get("GEMINI_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch resume text
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

    // Fetch job description
    const { data: job, error: jobError } = await supabase
      .from("ai_jobs")
      .select("*")
      .eq("id", job_id)
      .eq("session_id", session_id)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Claude to rewrite resume
    const prompt = `Rewrite this resume to better match this job description. Keep all facts true, only reframe wording, reorder bullet points, and emphasize matching skills. Return the full rewritten resume as plain text.

ORIGINAL RESUME:
${session.resume_text.slice(0, 8000)}

JOB DESCRIPTION:
Title: ${job.title}
Company: ${job.company}
${job.jd_text ? `\nDescription:\n${job.jd_text.slice(0, 4000)}` : ""}`;

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`, {
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

    if (!geminiResponse.ok) {
      const errBody = await geminiResponse.text();
      console.error("Gemini rewrite error:", geminiResponse.status, errBody);
      throw new Error(`Gemini API returned ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const rewrittenResume = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return new Response(
      JSON.stringify({ rewritten_resume: rewrittenResume }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("rewrite-resume error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
