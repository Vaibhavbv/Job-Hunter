import PublicHeader from '../components/PublicHeader'
import { usePageTitle } from '../hooks/usePageTitle'

/**
 * Terms, privacy (DPDP-aligned), and refund policy on one public page.
 * Plain-language self-serve terms for an indie product — review with a
 * lawyer before significant scale.
 */
export default function Legal() {
  usePageTitle('Terms, Privacy & Refunds — JobHunter')

  return (
    <div className="min-h-screen">
      <PublicHeader />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-14 space-y-12">
        <div>
          <h1 className="font-display font-bold text-3xl tracking-tight">
            The <span className="text-accent">fine print</span>
          </h1>
          <p className="text-dark-muted text-xs font-mono mt-2">
            Last updated: July 2026 · Questions? Open an issue on GitHub or email the operator.
          </p>
        </div>

        <section id="terms" className="space-y-3">
          <h2 className="font-display font-bold text-xl">Terms of Service</h2>
          <div className="text-sm font-body text-dark-muted leading-relaxed space-y-3">
            <p>
              JobHunter aggregates publicly listed job postings and provides AI-assisted analysis
              of them against your profile. By creating an account you agree to these terms.
            </p>
            <p>
              <span className="text-white">What we promise:</span> we run the scrapers daily,
              score jobs honestly against your profile, and never invent facts when tailoring your
              resume. AI output can still be wrong — always review a tailored resume before
              sending it, and verify job details on the original posting before applying.
            </p>
            <p>
              <span className="text-white">What you promise:</span> one account per person, no
              scraping or reselling our data, no attempting to bypass usage limits, and no
              uploading resumes that aren't yours (or that you don't have permission to use).
            </p>
            <p>
              Job listings belong to their original platforms and employers; we link back to the
              source. We may suspend accounts that abuse the service. We can change these terms
              with notice on this page.
            </p>
          </div>
        </section>

        <section id="privacy" className="space-y-3">
          <h2 className="font-display font-bold text-xl">Privacy Policy</h2>
          <div className="text-sm font-body text-dark-muted leading-relaxed space-y-3">
            <p>
              Your resume is sensitive personal data. We handle it in line with India's Digital
              Personal Data Protection (DPDP) Act principles: collected with consent, used only
              for the purpose you gave it, kept no longer than needed.
            </p>
            <p>
              <span className="text-white">What we store:</span> your account email and name, your
              profile preferences, your resume text (to score jobs and tailor resumes for you),
              your evaluations and tracked applications. Data lives in Supabase (Postgres) with
              row-level security — only your authenticated account can read your rows.
            </p>
            <p>
              <span className="text-white">What we share:</span> resume text is sent to Google's
              Gemini API to perform the analysis you request, and payment details are handled by
              Razorpay — we never see your card or UPI credentials. We don't sell your data or use
              it to train models. The anonymous ATS-score tool doesn't store your resume at all.
            </p>
            <p>
              <span className="text-white">Your rights:</span> you can export your data or delete
              your account (which cascades: profile, resume, evaluations, tracker, sessions) at
              any time — contact the operator or use the in-app options as they ship.
            </p>
          </div>
        </section>

        <section id="refunds" className="space-y-3">
          <h2 className="font-display font-bold text-xl">Refund Policy</h2>
          <div className="text-sm font-body text-dark-muted leading-relaxed space-y-3">
            <p>
              <span className="text-white">Pro subscriptions:</span> full refund within 7 days of
              a payment if you've used fewer than 10 AI actions in that period — email with your
              payment ID. Periods already consumed aren't refundable after that window.
            </p>
            <p>
              <span className="text-white">Credit packs:</span> unused credits are refundable
              within 7 days of purchase; partially used packs are refunded pro-rata at the pack's
              per-credit price. Credits expire 12 months after purchase.
            </p>
            <p>
              Refunds are processed to the original payment method via Razorpay, typically within
              5–7 business days.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
