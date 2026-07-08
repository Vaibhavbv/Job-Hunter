import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import PublicHeader from '../components/PublicHeader'
import { usePageTitle } from '../hooks/usePageTitle'
import { scoreResumeAnonymous, type AtsScoreResult } from '../services/api'

/**
 * Free, ungated Resume ATS Score — the top-of-funnel growth tool.
 * Paste-only on purpose: PDF parsing (and fixing the issues we find)
 * lives behind sign-up.
 */
export default function ResumeScore() {
  usePageTitle(
    'Free Resume ATS Score — JobHunter',
    'Paste your resume, get an instant AI-powered ATS score and your top 3 fixes. Free, no sign-up required.',
  )

  const [text, setText] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AtsScoreResult | null>(null)

  const handleCheck = async () => {
    setError('')
    setResult(null)
    if (text.trim().length < 100) {
      setError('Paste your full resume text — at least 100 characters.')
      return
    }
    setChecking(true)
    try {
      setResult(await scoreResumeAnonymous(text))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again')
    } finally {
      setChecking(false)
    }
  }

  const scoreColor =
    result == null ? '' : result.ats_score >= 70 ? 'text-accent' : result.ats_score >= 45 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="min-h-screen">
      <PublicHeader />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-14">
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-3xl tracking-tight">
            Will your resume survive the <span className="text-accent">ATS</span>?
          </h1>
          <p className="text-dark-muted text-sm font-body mt-3">
            Paste your resume below — instant AI score and your top 3 fixes. Free, no sign-up.
          </p>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your resume text here…"
          rows={12}
          className="premium-input w-full rounded-2xl text-sm resize-y"
          aria-label="Resume text"
        />
        <div className="flex items-center justify-between mt-2 mb-4">
          <span className="text-[11px] font-mono text-dark-muted/60">
            {text.length.toLocaleString()} characters
          </span>
          <span className="text-[11px] font-mono text-dark-muted/60">3 free checks per day</span>
        </div>

        <motion.button
          onClick={handleCheck}
          disabled={checking}
          className="premium-btn w-full py-3.5 rounded-xl text-sm font-mono disabled:opacity-60"
          whileTap={{ scale: 0.98 }}
        >
          {checking ? 'Analyzing your resume…' : 'Check my ATS score →'}
        </motion.button>

        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm font-mono">
            ✗ {error}
          </div>
        )}

        <AnimatePresence>
          {result && (
            <motion.div
              className="mt-8 bg-dark-card border border-dark-border rounded-2xl p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-center pb-5 border-b border-dark-border/50">
                <p className="font-mono text-[11px] text-dark-muted uppercase tracking-wider">Your ATS score</p>
                <p className={`font-display font-bold text-6xl mt-2 ${scoreColor}`}>{result.ats_score}</p>
                <p className="text-dark-muted text-sm font-body mt-3 max-w-md mx-auto">{result.summary}</p>
              </div>

              <div className="pt-5">
                <p className="font-mono text-[11px] text-dark-muted uppercase tracking-wider mb-3">
                  Your top 3 fixes
                </p>
                <ol className="space-y-2.5">
                  {result.top_fixes.map((fix, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm font-body">
                      <span className="text-accent font-mono text-xs font-bold mt-0.5">{i + 1}.</span>
                      {fix}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="mt-6 pt-5 border-t border-dark-border/50 text-center">
                <p className="text-sm font-body text-dark-muted mb-4">
                  Want these fixed automatically — and every job scored against the improved resume?
                </p>
                <Link to="/auth" className="premium-btn inline-block px-7 py-3 rounded-xl text-sm font-mono">
                  Fix it free — create account →
                </Link>
                <p className="text-dark-muted/60 font-mono text-[11px] mt-3">
                  {result.remaining_today} free check{result.remaining_today === 1 ? '' : 's'} left today
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
