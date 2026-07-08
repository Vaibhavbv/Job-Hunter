import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// PUBLIC, UNAUTHENTICATED endpoint — the free "Resume ATS Score" growth
// tool (docs/PRODUCT_STRATEGY.md §6). Deploy with:
//   supabase functions deploy ats-score --no-verify-jwt
//
// Abuse controls:
//   - Hard rate limit per IP per 24h (rows in usage_log with null
//     session_id act as the counter; written via service role).
//   - Input capped at 15k chars; nothing is stored — anonymous resumes
//     never touch the database.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DAILY_LIMIT = 3;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function buildPrompt(resumeText: string): string {
  return `You are an ATS (Applicant Tracking System) analysis engine used by Indian job seekers.

Analyze the resume below for ATS-readiness: parseable structure, keyword strength for the candidate's apparent target roles, quantified achievements, action verbs, section completeness, and length.

RESUME:
${resumeText}

Return ONLY a JSON object with these exact fields:
{
  "ats_score": <0-100 integer — how well this resume will survive ATS screening>,
  "top_fixes": ["<fix 1>", "<fix 2>", "<fix 3>"],
  "summary": "<one encouraging but honest sentence about the resume's current state>"
}
The three fixes must be specific and actionable for THIS resume, not generic advice. No markdown fences, no extra text.`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) throw new Error("GEMINI_API_KEY not configured");

    const { resume_text } = await req.json();
    if (!resume_text || typeof resume_text !== "string" || resume_text.trim().length < 100) {
      return json({ error: "Paste your resume text (at least 100 characters)." }, 400);
    }

    // ── IP rate limit ──
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("usage_log")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", ip)
      .is("session_id", null)
      .gte("fetched_at", dayAgo);

    const used = count ?? 0;
    if (used >= DAILY_LIMIT) {
      return json(
        {
          error: `Free limit reached (${DAILY_LIMIT} checks per day). Sign up for full AI matching + resume tailoring.`,
          code: "rate_limited",
        },
        429,
      );
    }

    // Record this attempt before the expensive call.
    await admin.from("usage_log").insert({ ip_address: ip, session_id: null });

    // ── Gemini ──
    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(resume_text.slice(0, 15000)) }] }],
        }),
      },
    );
    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      console.error("ats-score Gemini error:", geminiResp.status, errText);
      throw new Error("AI analysis failed — please try again");
    }

    const data = await geminiResp.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let atsScore = 0;
    let topFixes: string[] = [];
    let summary = "";
    try {
      const parsed = JSON.parse(cleaned);
      atsScore = Math.min(100, Math.max(0, Math.round(Number(parsed.ats_score) || 0)));
      topFixes = Array.isArray(parsed.top_fixes) ? parsed.top_fixes.slice(0, 3).map(String) : [];
      summary = String(parsed.summary || "");
    } catch {
      console.error("ats-score: unparseable Gemini response:", cleaned.slice(0, 300));
      throw new Error("AI analysis failed — please try again");
    }

    return json({
      ats_score: atsScore,
      top_fixes: topFixes,
      summary,
      remaining_today: Math.max(0, DAILY_LIMIT - used - 1),
    });
  } catch (error) {
    console.error("ats-score error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return json({ error: message }, 500);
  }
});
