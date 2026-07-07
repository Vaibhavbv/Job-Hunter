import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// Razorpay → server webhook. No CORS needed (server-to-server).
//
// Contract:
//   - Signature: HMAC-SHA256 of the raw body with RAZORPAY_WEBHOOK_SECRET,
//     sent as x-razorpay-signature. Verified with a timing-safe compare.
//   - Idempotency: x-razorpay-event-id is inserted into payment_events
//     BEFORE processing; a duplicate key means the event was already
//     handled and is acked with 200 without reprocessing.
//   - payment.captured grants the entitlement recorded in the order notes
//     ({ user_id, item_type, item_id }) set by razorpay-checkout, after
//     re-validating the captured amount against the catalog price.

const encoder = new TextEncoder();

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const PERIOD_DAYS: Record<string, number> = { month: 30, year: 365 };

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    if (!webhookSecret) throw new Error("RAZORPAY_WEBHOOK_SECRET not configured");

    // ── 1. Verify signature over the RAW body ──
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";
    const expected = await hmacSha256Hex(webhookSecret, rawBody);
    if (!signature || !timingSafeEqual(signature, expected)) {
      console.error("razorpay-webhook: bad signature");
      return json({ error: "Invalid signature" }, 400);
    }

    const event = JSON.parse(rawBody);
    const eventId = req.headers.get("x-razorpay-event-id") || crypto.randomUUID();

    // Service role: webhook writes bypass RLS by design.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 2. Idempotency gate ──
    const { error: insertError } = await admin
      .from("payment_events")
      .insert({ id: eventId, event_type: event.event, payload: event });
    if (insertError) {
      if (insertError.code === "23505") {
        // Already processed — ack so Razorpay stops retrying.
        return json({ status: "already_processed" });
      }
      throw insertError;
    }

    // ── 3. Handle the event ──
    if (event.event !== "payment.captured") {
      return json({ status: "ignored", event: event.event });
    }

    const payment = event.payload?.payment?.entity;
    const notes = payment?.notes || {};
    const { user_id, item_type, item_id } = notes;

    if (!user_id || !item_type || !item_id) {
      console.error("razorpay-webhook: payment.captured without our notes", payment?.id);
      return json({ status: "ignored", reason: "missing notes" });
    }

    if (item_type === "credit_pack") {
      const { data: pack } = await admin
        .from("credit_packs")
        .select("id, credits, price_inr")
        .eq("id", item_id)
        .single();
      if (!pack) throw new Error(`Unknown credit pack in notes: ${item_id}`);
      if (payment.amount !== pack.price_inr * 100) {
        throw new Error(
          `Amount mismatch for ${item_id}: paid ${payment.amount}, expected ${pack.price_inr * 100}`,
        );
      }

      const { error } = await admin.from("credit_ledger").insert({
        user_id,
        delta: pack.credits,
        reason: "purchase",
        ref: payment.id,
      });
      if (error) throw error;

      return json({ status: "credits_granted", credits: pack.credits });
    }

    if (item_type === "plan") {
      const { data: plan } = await admin
        .from("plans")
        .select("id, price_inr, billing_interval")
        .eq("id", item_id)
        .single();
      if (!plan) throw new Error(`Unknown plan in notes: ${item_id}`);
      if (payment.amount !== plan.price_inr * 100) {
        throw new Error(
          `Amount mismatch for ${item_id}: paid ${payment.amount}, expected ${plan.price_inr * 100}`,
        );
      }

      const periodDays = PERIOD_DAYS[plan.billing_interval];
      if (!periodDays) throw new Error(`Plan ${item_id} is not purchasable`);

      const now = new Date();

      // Stack onto an existing live subscription (renewal before expiry
      // extends from the current period end), otherwise start fresh.
      const { data: live } = await admin
        .from("subscriptions")
        .select("id, current_period_end")
        .eq("user_id", user_id)
        .in("status", ["trialing", "active"])
        .maybeSingle();

      const base =
        live?.current_period_end && new Date(live.current_period_end) > now
          ? new Date(live.current_period_end)
          : now;
      const periodEnd = new Date(base.getTime() + periodDays * 24 * 60 * 60 * 1000);

      if (live) {
        const { error } = await admin
          .from("subscriptions")
          .update({
            plan_id: plan.id,
            status: "active",
            razorpay_order_id: payment.order_id,
            razorpay_payment_id: payment.id,
            current_period_end: periodEnd.toISOString(),
          })
          .eq("id", live.id);
        if (error) throw error;
      } else {
        const { error } = await admin.from("subscriptions").insert({
          user_id,
          plan_id: plan.id,
          status: "active",
          razorpay_order_id: payment.order_id,
          razorpay_payment_id: payment.id,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        });
        if (error) throw error;
      }

      const { error: profileError } = await admin
        .from("profiles")
        .update({ plan: plan.id })
        .eq("id", user_id);
      if (profileError) throw profileError;

      return json({ status: "subscription_active", plan: plan.id });
    }

    return json({ status: "ignored", reason: `unknown item_type ${item_type}` });
  } catch (error) {
    console.error("razorpay-webhook error:", error);
    // Non-2xx → Razorpay retries, which is what we want for transient failures.
    const message = error instanceof Error ? error.message : "Internal server error";
    return json({ error: message }, 500);
  }
});
