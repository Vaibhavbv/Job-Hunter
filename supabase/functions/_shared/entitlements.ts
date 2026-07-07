/**
 * Shared entitlement/metering guard for AI actions (Roadmap Phase A, step 4).
 *
 * Rules (see docs/PRODUCT_STRATEGY.md §4):
 *   - An action is an evaluation (1 credit) or a resume rewrite (3 credits).
 *   - The plan's monthly free allowance is consumed first; usage is counted
 *     from existing rows (evaluations.evaluated_at / resumes.created_at in
 *     the current calendar month) — no counter table.
 *   - Beyond the allowance, actions spend credits from credit_ledger.
 *   - FAIL OPEN: if the billing migration isn't applied (plans table
 *     missing), everything is allowed — enforcement only switches on when
 *     billing actually exists in the connected database.
 *
 * All reads/writes here use the service-role client: credit_ledger has no
 * user insert policy by design.
 */
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

export type ActionKind = "eval" | "resume_rewrite";

export const CREDIT_COST: Record<ActionKind, number> = {
  eval: 1,
  resume_rewrite: 3,
};

export interface Entitlement {
  /** false = billing tables absent → nothing is enforced */
  billingEnabled: boolean;
  planId: string;
  /** Free actions left this month for this action kind; null = unlimited plan */
  freeRemaining: number | null;
  creditBalance: number;
  /** How many actions of this kind the user may run right now (Infinity = unlimited) */
  allowance: number;
}

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function monthStartISO(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export async function getEntitlement(
  admin: SupabaseClient,
  userId: string,
  action: ActionKind,
): Promise<Entitlement> {
  // 1. Billing enabled at all? (plans table present and seeded)
  interface PlanRow {
    id: string;
    monthly_evals: number | null;
    monthly_rewrites: number | null;
  }
  const { data, error: plansError } = await admin
    .from("plans")
    .select("id, monthly_evals, monthly_rewrites");
  const plans = data as PlanRow[] | null;
  if (plansError || !plans || plans.length === 0) {
    return {
      billingEnabled: false,
      planId: "free",
      freeRemaining: null,
      creditBalance: 0,
      allowance: Infinity,
    };
  }

  // 2. Resolve the live plan: an active/trialing subscription still inside
  //    its prepaid period, else free.
  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan_id, status, current_period_end")
    .eq("user_id", userId)
    .in("status", ["trialing", "active"])
    .maybeSingle();

  const now = new Date();
  const live =
    sub && (!sub.current_period_end || new Date(sub.current_period_end) > now);
  const planId = live ? sub!.plan_id : "free";

  const plan = plans.find((p) => p.id === planId) ?? plans.find((p) => p.id === "free");
  if (!plan) {
    // Catalog exists but has no matching row — never lock users out on our
    // own misconfiguration.
    console.warn(`entitlements: no plan row for '${planId}', failing open`);
    return { billingEnabled: true, planId, freeRemaining: null, creditBalance: 0, allowance: Infinity };
  }

  const limit = action === "eval" ? plan.monthly_evals : plan.monthly_rewrites;

  // 3. Usage this month, counted from the action's own table.
  const monthStart = monthStartISO();
  const usageQuery =
    action === "eval"
      ? admin
          .from("evaluations")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("evaluated_at", monthStart)
      : admin
          .from("resumes")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("created_at", monthStart);
  const { count } = await usageQuery;
  const used = count ?? 0;

  const freeRemaining = limit == null ? null : Math.max(0, limit - used);

  // 4. Credit balance.
  const { data: ledger } = await admin
    .from("credit_ledger")
    .select("delta")
    .eq("user_id", userId);
  const creditBalance = (ledger ?? []).reduce(
    (sum: number, row: { delta: number }) => sum + row.delta,
    0,
  );

  const allowance =
    freeRemaining == null
      ? Infinity
      : freeRemaining + Math.floor(Math.max(0, creditBalance) / CREDIT_COST[action]);

  return { billingEnabled: true, planId, freeRemaining, creditBalance, allowance };
}

/**
 * Debit credits for the portion of `units` actions not covered by the free
 * allowance. Call AFTER the action succeeded. No-op when billing is off,
 * the plan is unlimited, or the free allowance covered everything.
 */
export async function settleUsage(
  admin: SupabaseClient,
  userId: string,
  action: ActionKind,
  units: number,
  entitlement: Entitlement,
  ref: string,
): Promise<void> {
  if (!entitlement.billingEnabled || entitlement.freeRemaining == null || units <= 0) return;

  const creditUnits = Math.max(0, units - entitlement.freeRemaining);
  if (creditUnits === 0) return;

  const { error } = await admin.from("credit_ledger").insert({
    user_id: userId,
    delta: -(creditUnits * CREDIT_COST[action]),
    reason: action,
    ref,
  });
  if (error) {
    // The action already succeeded — log loudly rather than failing the
    // user's request over the debit write.
    console.error("entitlements: failed to record credit debit:", error);
  }
}

/** Standard 402 body for an exhausted allowance. */
export function limitResponse(action: ActionKind, entitlement: Entitlement) {
  const noun = action === "eval" ? "AI evaluations" : "resume tailors";
  return {
    error:
      `Monthly ${noun} limit reached on the ${entitlement.planId === "free" ? "Free" : entitlement.planId} plan. ` +
      `Upgrade to Pro or buy credits in Settings → Billing.`,
    code: "limit_reached",
    plan: entitlement.planId,
    free_remaining: entitlement.freeRemaining,
    credit_balance: entitlement.creditBalance,
  };
}
