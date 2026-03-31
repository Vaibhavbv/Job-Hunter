import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { resume_text } = await req.json();

    if (!resume_text || typeof resume_text !== "string" || resume_text.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: "Resume text is required and must be at least 50 characters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Claude API to extract job titles
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-latest",
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: `Here is a resume:\n\n${resume_text.slice(0, 8000)}\n\nExtract job titles this person is best suited for. Return exactly 5 job titles as a JSON array, ordered by relevance. Only return the JSON array, nothing else.`,
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errBody = await claudeResponse.text();
      console.error("Claude API error:", claudeResponse.status, errBody);
      throw new Error(`Claude API returned ${claudeResponse.status}`);
    }

    const claudeData = await claudeResponse.json();
    const rawText = claudeData.content?.[0]?.text || "[]";

    // Parse the JSON array from Claude's response
    let jobTitles: string[];
    try {
      jobTitles = JSON.parse(rawText);
      if (!Array.isArray(jobTitles)) throw new Error("Not an array");
      jobTitles = jobTitles.slice(0, 5).map((t: unknown) => String(t).trim());
    } catch {
      console.error("Failed to parse Claude response as JSON array:", rawText);
      // Fallback: try to extract titles from text
      jobTitles = rawText
        .replace(/[\[\]"]/g, "")
        .split(",")
        .map((t: string) => t.trim())
        .filter((t: string) => t.length > 0)
        .slice(0, 5);
    }

    // Store in Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get caller IP for rate limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               req.headers.get("x-real-ip") || "unknown";

    const { data: session, error: insertError } = await supabase
      .from("user_sessions")
      .insert({
        resume_text: resume_text.slice(0, 50000), // cap at 50k chars
        job_titles: jobTitles,
        ip_address: ip,
      })
      .select("id, job_titles")
      .single();

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      throw new Error("Failed to save session");
    }

    return new Response(
      JSON.stringify({
        session_id: session.id,
        job_titles: session.job_titles,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("parse-resume error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
