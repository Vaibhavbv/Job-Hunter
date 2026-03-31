import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

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
    const apifyToken = Deno.env.get("APIFY_TOKEN");
    if (!apifyToken) {
      throw new Error("APIFY_TOKEN not configured");
    }

    // Fetch Apify user account info
    const resp = await fetch(`https://api.apify.com/v2/users/me?token=${apifyToken}`);
    if (!resp.ok) {
      throw new Error(`Apify API returned ${resp.status}`);
    }

    const userData = await resp.json();
    const plan = userData.data?.plan || {};
    const monthlyUsage = plan.monthlyUsageUsd || userData.data?.proxy?.monthlyUsageUsd || 0;
    const monthlyLimit = plan.monthlyUsageLimitUsd || 5.0; // Default free tier

    // Calculate remaining percentage and estimated runs
    const used = Number(monthlyUsage) || 0;
    const limit = Number(monthlyLimit) || 5.0;
    const remaining = Math.max(0, limit - used);
    const remainingPercent = limit > 0 ? Math.round((remaining / limit) * 100) : 0;

    // Average cost per 15-job fetch (estimate based on Apify pay-per-result)
    const AVG_COST_PER_RUN = 0.02;
    const estimatedRunsRemaining = Math.floor(remaining / AVG_COST_PER_RUN);

    return new Response(
      JSON.stringify({
        used: Math.round(used * 100) / 100,
        limit: Math.round(limit * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        remaining_percent: remainingPercent,
        estimated_runs: estimatedRunsRemaining,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("check-credits error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
