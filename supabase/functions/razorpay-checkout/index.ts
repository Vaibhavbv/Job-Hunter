import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface CheckoutRequest {
  item_type: "plan" | "credit_pack";
  item_id: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Authenticate the user via JWT ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Unauthorized: Missing Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return json({ error: "Unauthorized: Invalid token" }, 401);
    }

    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error("Razorpay keys not configured");
    }

    // ── Validate the requested item and resolve its price SERVER-SIDE.
    //    The client never supplies an amount. ──
    const body: CheckoutRequest = await req.json();
    const { item_type, item_id } = body;

    if (item_type !== "plan" && item_type !== "credit_pack") {
      return json({ error: "item_type must be 'plan' or 'credit_pack'" }, 400);
    }
    if (!item_id || typeof item_id !== "string") {
      return json({ error: "item_id is required" }, 400);
    }

    const table = item_type === "plan" ? "plans" : "credit_packs";
    const { data: item, error: itemError } = await supabase
      .from(table)
      .select("id, name, price_inr, is_active")
      .eq("id", item_id)
      .single();

    if (itemError || !item || !item.is_active) {
      return json({ error: `Unknown ${item_type}: ${item_id}` }, 404);
    }
    if (item.price_inr <= 0) {
      return json({ error: "This item is free — nothing to purchase" }, 400);
    }

    // ── Create the Razorpay order (amount in paise) ──
    const orderResp = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
      },
      body: JSON.stringify({
        amount: item.price_inr * 100,
        currency: "INR",
        notes: {
          user_id: user.id,
          item_type,
          item_id,
        },
      }),
    });

    if (!orderResp.ok) {
      const detail = await orderResp.text();
      console.error("Razorpay order creation failed:", detail);
      return json({ error: "Payment provider error — please try again" }, 502);
    }

    const order = await orderResp.json();

    // The frontend hands these to Razorpay Checkout JS. key_id is public.
    return json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: razorpayKeyId,
      item_name: item.name,
    });
  } catch (error) {
    console.error("razorpay-checkout error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return json({ error: message }, 500);
  }
});
