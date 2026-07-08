import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useQuery } from '@tanstack/react-query'
import PublicHeader from '../components/PublicHeader'
import { usePageTitle } from '../hooks/usePageTitle'
import { supabase } from '../hooks/useSupabase'
import { useAuth } from '../hooks/useAuth'
import type { Plan, CreditPack } from '../types/database'

/**
 * Public pricing page. Reads the live catalog (plans/credit_packs are
 * public-select) and falls back to the seeded values when the billing
 * migration isn't applied, so the page never renders empty.
 */

const FALLBACK_PLANS: Pick<Plan, 'id' | 'name' | 'price_inr' | 'billing_interval' | 'monthly_evals' | 'monthly_rewrites'>[] = [
  { id: 'free', name: 'Free', price_inr: 0, billing_interval: 'none', monthly_evals: 10, monthly_rewrites: 1 },
  { id: 'pro_monthly', name: 'Pro', price_inr: 399, billing_interval: 'month', monthly_evals: null, monthly_rewrites: 100 },
  { id: 'pro_yearly', name: 'Pro Annual', price_inr: 2999, billing_interval: 'year', monthly_evals: null, monthly_rewrites: 100 },
]

const FALLBACK_PACKS: Pick<CreditPack, 'id' | 'name' | 'price_inr' | 'credits'>[] = [
  { id: 'pack_50', name: 'Starter — 50 credits', price_inr: 99, credits: 50 },
  { id: 'pack_175', name: 'Plus — 175 credits', price_inr: 299, credits: 175 },
  { id: 'pack_400', name: 'Power — 400 credits', price_inr: 599, credits: 400 },
]

const PLAN_BLURBS: Record<string, string[]> = {
  free: [
    'Full job board — browse, search, filter',
    '10 AI match evaluations / month',
    '1 ATS resume tailor / month',
    'Application tracker',
  ],
  pro_monthly: [
    'Unlimited AI match evaluations',
    'Resume tailoring (fair-use 100/mo)',
    'Daily A+ match alerts (coming soon)',
    'Advanced analytics + export (coming soon)',
  ],
  pro_yearly: [
    'Everything in Pro',
    '~37% cheaper than monthly',
    'One payment, 12 months',
    'Lock in launch pricing',
  ],
}

export default function Pricing() {
  usePageTitle(
    'Pricing — JobHunter',
    'Free job board with 10 AI evaluations a month. Pro at ₹399/month for unlimited AI matching and resume tailoring. Credit packs from ₹99.',
  )
  const { user } = useAuth()

  const { data } = useQuery({
    queryKey: ['public-pricing'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const [plansRes, packsRes] = await Promise.all([
        supabase.from('plans').select('*').eq('is_active', true).order('price_inr'),
        supabase.from('credit_packs').select('*').eq('is_active', true).order('price_inr'),
      ])
      return {
        plans: plansRes.error || !plansRes.data?.length ? FALLBACK_PLANS : plansRes.data,
        packs: packsRes.error || !packsRes.data?.length ? FALLBACK_PACKS : packsRes.data,
      }
    },
  })

  const plans = data?.plans ?? FALLBACK_PLANS
  const packs = data?.packs ?? FALLBACK_PACKS
  const ctaTarget = user ? '/settings' : '/auth'
  const ctaLabel = user ? 'Manage in Settings →' : 'Start free →'

  return (
    <div className="min-h-screen">
      <PublicHeader />

      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight">
            Simple pricing, in <span className="text-accent">rupees</span>
          </h1>
          <p className="text-dark-muted text-sm font-body mt-3 max-w-xl mx-auto">
            The board is free forever. Pay only for AI horsepower — subscribe, or top up credits
            as you go. Purchases happen inside the app under Settings → Billing.
          </p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-14">
          {plans.map((plan, idx) => {
            const highlight = plan.id === 'pro_monthly'
            return (
              <motion.div
                key={plan.id}
                className={`rounded-2xl border p-6 flex flex-col ${
                  highlight ? 'bg-accent/5 border-accent/30 shadow-glow' : 'bg-dark-card border-dark-border'
                }`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
              >
                {highlight && (
                  <span className="self-start px-2 py-0.5 rounded bg-accent/15 text-accent font-mono text-[10px] font-bold mb-3">
                    MOST POPULAR
                  </span>
                )}
                <h2 className="font-display font-bold text-xl">{plan.name}</h2>
                <p className="mt-2 mb-5">
                  <span className="font-display font-bold text-3xl">
                    {plan.price_inr === 0 ? '₹0' : `₹${plan.price_inr.toLocaleString('en-IN')}`}
                  </span>
                  {plan.billing_interval !== 'none' && (
                    <span className="text-dark-muted font-mono text-xs">
                      /{plan.billing_interval === 'year' ? 'year' : 'month'}
                    </span>
                  )}
                </p>
                <ul className="space-y-2 flex-1">
                  {(PLAN_BLURBS[plan.id] ?? []).map((line) => (
                    <li key={line} className="flex items-start gap-2 text-sm font-body text-dark-muted">
                      <span className="text-accent font-mono text-xs mt-0.5">✓</span>
                      {line}
                    </li>
                  ))}
                </ul>
                <Link
                  to={ctaTarget}
                  className={`mt-6 text-center rounded-xl py-2.5 text-sm font-mono font-bold transition-colors ${
                    highlight
                      ? 'premium-btn'
                      : 'border border-dark-border text-dark-muted hover:text-white hover:border-accent/30'
                  }`}
                >
                  {ctaLabel}
                </Link>
              </motion.div>
            )
          })}
        </div>

        {/* Credit packs */}
        <div className="text-center mb-6">
          <h2 className="font-display font-bold text-xl">
            Or just top up <span className="text-accent">credits</span>
          </h2>
          <p className="text-dark-muted text-xs font-mono mt-2">
            1 credit = 1 AI evaluation · 3 credits = 1 resume tailor · valid 12 months
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {packs.map((pack) => (
            <div key={pack.id} className="bg-dark-card border border-dark-border rounded-2xl p-5 text-center">
              <p className="font-display font-bold text-2xl">{pack.credits}</p>
              <p className="text-dark-muted font-mono text-[11px] uppercase tracking-wider">credits</p>
              <p className="text-accent font-mono text-sm font-bold mt-2">
                ₹{pack.price_inr.toLocaleString('en-IN')}
              </p>
            </div>
          ))}
        </div>

        <p className="text-center text-dark-muted/60 font-mono text-[11px] mt-10">
          Payments via Razorpay (UPI, cards, netbanking) · See{' '}
          <Link to="/legal" className="underline hover:text-white">refund policy</Link>
        </p>
      </div>
    </div>
  )
}
