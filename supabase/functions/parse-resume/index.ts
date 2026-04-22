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
    // Authenticate the user via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { resume_text } = await req.json();

    if (!resume_text || typeof resume_text !== "string" || resume_text.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: "Resume text is required and must be at least 50 characters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    // Initialize Supabase with the user's JWT to enforce RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the authenticated user's ID
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Gemini API to extract job titles
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Here is a resume:\n\n${resume_text.slice(0, 8000)}\n\nExtract job titles this person is best suited for. Return exactly 5 job titles as a JSON array, ordered by relevance. Only return the JSON array, nothing else.`,
              },
            ],
          },
        ],
      }),
    });

    if (!geminiResponse.ok) {
      const errBody = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errBody);
      throw new Error(`Gemini API returned ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    let rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

    // Clean up markdown code blocks if Gemini returns them
    rawText = rawText.replace(/```json\n/g, "").replace(/```/g, "").trim();

    // Parse the JSON array from Gemini's response
    let jobTitles: string[];
    try {
      jobTitles = JSON.parse(rawText);
      if (!Array.isArray(jobTitles)) throw new Error("Not an array");
      jobTitles = jobTitles.slice(0, 5).map((t: unknown) => String(t).trim());
    } catch {
      console.error("Failed to parse Gemini response as JSON array:", rawText);
      // Fallback: try to extract titles from text
      jobTitles = rawText
        .replace(/[\[\]"]/g, "")
        .split(",")
        .map((t: string) => t.trim())
        .filter((t: string) => t.length > 0)
        .slice(0, 5);
    }

    // Store in Supabase — set user_id for RLS
    const { data: session, error: insertError } = await supabase
      .from("user_sessions")
      .insert({
        user_id: user.id,
        resume_text: resume_text.slice(0, 50000),
        job_titles: jobTitles,
        ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
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
