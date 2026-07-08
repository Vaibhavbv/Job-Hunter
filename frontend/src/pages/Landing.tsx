import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import PublicHeader from '../components/PublicHeader'
import { usePageTitle } from '../hooks/usePageTitle'

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
}

const STEPS = [
  {
    n: '01',
    title: 'Upload your resume once',
    body: 'We extract your skills, seniority, and target roles — that becomes the lens every job is judged through.',
  },
  {
    n: '02',
    title: 'Every job gets a grade',
    body: 'Fresh listings from LinkedIn, Naukri & Indeed are scored A+ to F against YOUR profile across 5 dimensions — not keyword soup.',
  },
  {
    n: '03',
    title: 'Apply with a tailored resume',
    body: 'One click rewrites your resume for that exact job description, ATS-optimized, without inventing a word.',
  },
]

const FEATURES = [
  { icon: '🎯', title: 'A+–F match grades', body: '5-dimension scoring: technical, seniority, domain, salary, location fit.' },
  { icon: '📄', title: 'ATS resume tailoring', body: 'Truthful rewrites that mirror the JD keywords and survive the filters.' },
  { icon: '📡', title: 'Daily fresh listings', body: 'LinkedIn, Naukri & Indeed scraped every morning — no stale posts.' },
  { icon: '◫', title: 'Application tracker', body: 'Kanban pipeline from Applied to Offer, with drag-and-drop.' },
  { icon: '◩', title: 'Market analytics', body: 'Where the demand is, which companies are hiring, salary signals.' },
  { icon: '⚡', title: 'Fair pricing in ₹', body: 'Generous free tier. Credits when you need a burst. Pro when you are all-in.' },
]

export default function Landing() {
  usePageTitle(
    'JobHunter — Stop applying blind. AI job matching + resume tailoring',
    'Every job from LinkedIn, Naukri & Indeed scored A+ to F against your resume — and a resume auto-tailored to each one in seconds. Free ATS score included.',
  )

  return (
    <div className="min-h-screen">
      <PublicHeader />

      {/* Hero */}
      <section className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-20 pb-16 text-center relative">
        <div className="auth-bg-orbs" aria-hidden>
          <div className="auth-orb auth-orb-1" />
          <div className="auth-orb auth-orb-3" />
        </div>
        <motion.div initial="hidden" animate="show" transition={{ staggerChildren: 0.12 }}>
          <motion.p variants={item} className="inline-block px-3 py-1 rounded-full border border-accent/20 bg-accent/5 text-accent font-mono text-[11px] mb-6">
            India-first · LinkedIn + Naukri + Indeed · scanned daily
          </motion.p>
          <motion.h1 variants={item} className="font-display font-bold text-4xl sm:text-6xl tracking-tight leading-[1.05]">
            Stop applying <span className="gradient-text">blind</span>.
          </motion.h1>
          <motion.p variants={item} className="text-dark-muted text-base sm:text-lg font-body mt-6 max-w-2xl mx-auto">
            Every job scored <span className="text-white font-semibold">A+ to F against your resume</span> — and a
            resume auto-tailored to each one in seconds. Apply to the right 5, not the random 50.
          </motion.p>
          <motion.div variants={item} className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10">
            <Link to="/tools/resume-score" className="premium-btn px-7 py-3.5 rounded-xl text-sm font-mono">
              Get your free ATS score →
            </Link>
            <Link to="/auth" className="premium-btn-outline">
              Browse live jobs — free
            </Link>
          </motion.div>
          <motion.p variants={item} className="text-dark-muted/60 font-mono text-[11px] mt-4">
            No card required · 10 free AI evaluations every month
          </motion.p>
        </motion.div>
      </section>

      {/* How it works */}
      <section className="max-w-[1100px] mx-auto px-4 sm:px-6 py-16">
        <h2 className="font-display font-bold text-2xl text-center mb-10">
          How it <span className="text-accent">works</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STEPS.map((s) => (
            <motion.div
              key={s.n}
              className="bg-dark-card border border-dark-border rounded-2xl p-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <span className="font-mono text-accent text-xs">{s.n}</span>
              <h3 className="font-display font-bold text-lg mt-2">{s.title}</h3>
              <p className="text-dark-muted text-sm font-body mt-2 leading-relaxed">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-[1100px] mx-auto px-4 sm:px-6 py-16">
        <h2 className="font-display font-bold text-2xl text-center mb-10">
          Built for the <span className="text-accent">Indian job hunt</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <motion.div
              key={f.title}
              className="bg-dark-card border border-dark-border rounded-2xl p-5 hover:border-accent/20 transition-colors"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <span className="text-2xl">{f.icon}</span>
              <h3 className="font-display font-bold text-base mt-3">{f.title}</h3>
              <p className="text-dark-muted text-sm font-body mt-1.5 leading-relaxed">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="max-w-[1100px] mx-auto px-4 sm:px-6 py-16 text-center">
        <h2 className="font-display font-bold text-2xl mb-3">
          Free to start. <span className="text-accent">₹399/mo</span> when you're serious.
        </h2>
        <p className="text-dark-muted text-sm font-body max-w-xl mx-auto">
          The job board is free forever. Free accounts get 10 AI evaluations and a resume tailor
          every month. Pro unlocks unlimited scoring, tailoring, and daily A+ match alerts.
        </p>
        <Link
          to="/pricing"
          className="inline-block mt-6 premium-btn-outline"
        >
          See full pricing →
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-dark-border/50 mt-8">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-dark-muted/60 font-mono text-[11px]">
            © {new Date().getFullYear()} JobHunter · Made in India
          </p>
          <nav className="flex items-center gap-4 text-[11px] font-mono text-dark-muted">
            <Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link to="/tools/resume-score" className="hover:text-white transition-colors">Free ATS Check</Link>
            <Link to="/legal" className="hover:text-white transition-colors">Terms & Privacy</Link>
            <a
              href="https://github.com/Vaibhavbv/Job-Hunter"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
