import { useQuery } from '@tanstack/react-query'
import { supabase } from './useSupabase'
import { useAuth } from './useAuth'
import type { Plan, CreditPack, Subscription } from '../types/database'

/**
 * Current user's billing state: plan, live subscription, credit balance,
 * and this month's AI usage (counted from existing evaluations/resumes
 * rows — there is no separate counter table; see 20260707_billing.sql).
 *
 * Degrades gracefully when the billing migration hasn't been applied to
 * the connected database yet: catalog queries erroring are treated as
 * "billing not available" instead of crashing (same convention as
 * useEvaluations' missing-table handling).
 */

interface EntitlementsData {
  billingAvailable: boolean
  plans: Plan[]
  creditPacks: CreditPack[]
  subscription: Subscription | null
  /** Resolved plan id: the live subscription's plan, else 'free'. */
  planId: string
  plan: Plan | null
  credits: number
  evalsUsed: number
  rewritesUsed: number
}

function monthStartISO(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

export function useEntitlements() {
  const { user } = useAuth()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['entitlements', user?.id],
    enabled: !!user,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<EntitlementsData> => {
      const monthStart = monthStartISO()

      const [plansRes, packsRes, subRes, balanceRes, evalCountRes, rewriteCountRes] =
        await Promise.all([
          supabase.from('plans').select('*').order('price_inr', { ascending: true }),
          supabase.from('credit_packs').select('*').order('price_inr', { ascending: true }),
          supabase
            .from('subscriptions')
            .select('*')
            .in('status', ['trialing', 'active'])
            .maybeSingle(),
          supabase.from('credit_balances').select('balance').maybeSingle(),
          supabase
            .from('evaluations')
            .select('id', { count: 'exact', head: true })
            .gte('evaluated_at', monthStart),
          supabase
            .from('resumes')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', monthStart),
        ])

      // Billing tables missing (migration not applied) → billing unavailable,
      // everything else still works.
      const plans = (plansRes.error ? [] : (plansRes.data ?? [])) as Plan[]
      const creditPacks = (packsRes.error ? [] : (packsRes.data ?? [])) as CreditPack[]
      const rawSub = (subRes.error ? null : subRes.data) as Subscription | null

      // A subscription only counts while its prepaid period is running.
      const now = new Date()
      const subscription =
        rawSub && (!rawSub.current_period_end || new Date(rawSub.current_period_end) > now)
          ? rawSub
          : null

      const planId = subscription?.plan_id ?? 'free'

      return {
        billingAvailable: plans.length > 0,
        plans,
        creditPacks,
        subscription,
        planId,
        plan: plans.find((p) => p.id === planId) ?? null,
        credits: balanceRes.error ? 0 : (balanceRes.data?.balance ?? 0),
        evalsUsed: evalCountRes.error ? 0 : (evalCountRes.count ?? 0),
        rewritesUsed: rewriteCountRes.error ? 0 : (rewriteCountRes.count ?? 0),
      }
    },
  })

  const plan = data?.plan ?? null

  return {
    loading: isLoading,
    error: error?.message || null,
    billingAvailable: data?.billingAvailable ?? false,
    plans: data?.plans ?? [],
    creditPacks: data?.creditPacks ?? [],
    subscription: data?.subscription ?? null,
    planId: data?.planId ?? 'free',
    plan,
    credits: data?.credits ?? 0,
    evalsUsed: data?.evalsUsed ?? 0,
    rewritesUsed: data?.rewritesUsed ?? 0,
    /** null = unlimited on the current plan */
    evalsRemaining:
      plan && plan.monthly_evals != null
        ? Math.max(0, plan.monthly_evals - (data?.evalsUsed ?? 0))
        : null,
    rewritesRemaining:
      plan && plan.monthly_rewrites != null
        ? Math.max(0, plan.monthly_rewrites - (data?.rewritesUsed ?? 0))
        : null,
    refetch,
  }
}
