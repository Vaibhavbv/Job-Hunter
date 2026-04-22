import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import CreditBadge from '../components/CreditBadge'
import ResumeRewriteModal from '../components/ResumeRewriteModal'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
}

export default function AIDashboard() {
  const navigate = useNavigate()
  const {
    sessionId,
    jobTitles,
    aiJobs,
    loading,
    step,
    error,
    fetchJobs,
    scoreJobs,
    clearSession,
  } = useSession()

  const [selectedJob, setSelectedJob] = useState(null)
  const [hasFetched, setHasFetched] = useState(false)

  // Redirect if no session
  useEffect(() => {
    if (!sessionId) {
      navigate('/upload')
    }
  }, [sessionId, navigate])

  // Sorted jobs by relevancy score
  const sortedJobs = useMemo(() => {
    return [...aiJobs].sort((a, b) => (b.relevancy_score || 0) - (a.relevancy_score || 0))
  }, [aiJobs])

  // Stats
  const stats = useMemo(() => {
    const scored = aiJobs.filter(j => j.relevancy_score != null)
    const avgScore = scored.length > 0
      ? Math.round(scored.reduce((s, j) => s + j.relevancy_score, 0) / scored.length)
      : 0
    const highMatch = scored.filter(j => j.relevancy_score >= 75).length
    const salaryListed = aiJobs.filter(j => j.salary && j.salary !== '').length

    return { total: aiJobs.length, scored: scored.length, avgScore, highMatch, salaryListed }
  }, [aiJobs])

  const handleFetchAndScore = async () => {
    try {
      await fetchJobs()
      setHasFetched(true)
      // Automatically score after fetching
      await scoreJobs()
    } catch (err) {
      console.error('Fetch & score failed:', err)
    }
  }

  const handleNewResume = () => {
    clearSession()
    navigate('/upload')
  }

  const scoreColor = (score) => {
    if (score >= 75) return '#00ff88'
    if (score >= 50) return '#fbbf24'
    if (score >= 25) return '#f97316'
    return '#ef4444'
  }

  const scoreLabel = (score) => {
    if (score >= 75) return 'Excellent'
    if (score >= 50) return 'Good'
    if (score >= 25) return 'Fair'
    return 'Low'
  }

  if (!sessionId) return null

  return (
    <motion.div
      className="max-w-7xl mx-auto px-4 sm:px-6 pb-12"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* ─── HEADER ─── */}
      <motion.div variants={item} className="flex items-center justify-between py-6">
        <div>
          <h1 className="font-display font-bold text-2xl tracking-tight">
            AI <span className="text-accent">Dashboard</span>
          </h1>
          <p className="text-dark-muted text-xs font-mono mt-1">
            Resume-matched jobs · Ranked by AI relevancy
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CreditBadge />
          <motion.button
            onClick={handleFetchAndScore}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent to-emerald-400 text-dark-bg font-mono text-sm font-bold hover:from-accent-dim hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-glow"
            whileTap={{ scale: 0.95 }}
          >
            {loading && step === 'fetching' ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-dark-bg/30 border-t-dark-bg rounded-full animate-spin" />
                Fetching...
              </span>
            ) : loading && step === 'scoring' ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-dark-bg/30 border-t-dark-bg rounded-full animate-spin" />
                Scoring...
              </span>
            ) : (
              '⚡ Fetch Latest Jobs'
            )}
          </motion.button>
          <motion.button
            onClick={handleNewResume}
            className="px-4 py-2.5 rounded-xl font-mono text-sm text-dark-muted border border-dark-border hover:border-accent/20 hover:text-white transition-all"
            whileTap={{ scale: 0.95 }}
          >
            ↑ New Resume
          </motion.button>
        </div>
      </motion.div>

      {/* ─── JOB TITLES BAND ─── */}
      <motion.div variants={item} className="flex flex-wrap items-center gap-2 mb-6">
        <span className="font-mono text-[10px] text-dark-muted uppercase tracking-wider">Targeting:</span>
        {jobTitles.map((title, i) => (
          <span
            key={i}
            className="px-3 py-1 rounded-lg bg-accent/5 text-accent border border-accent/10 font-mono text-xs"
          >
            {title}
          </span>
        ))}
      </motion.div>

      {/* ─── STATS ROW ─── */}
      {stats.total > 0 && (
        <motion.div variants={item} className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <StatCard label="Total Found" value={stats.total} />
          <StatCard label="AI Scored" value={stats.scored} />
          <StatCard label="Avg Score" value={stats.avgScore} color={scoreColor(stats.avgScore)} />
          <StatCard label="High Match" value={stats.highMatch} color="#00ff88" />
          <StatCard label="Salary Listed" value={stats.salaryListed} />
        </motion.div>
      )}

      {/* ─── ERROR ─── */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm font-mono"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            ✗ {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── LOADING STATE ─── */}
      {loading && (
        <motion.div
          className="text-center py-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="w-16 h-16 border-3 border-accent/20 border-t-accent rounded-full mx-auto mb-4"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <h3 className="font-display font-bold text-lg">
            {step === 'fetching' ? 'Fetching Jobs from LinkedIn...' :
             step === 'scoring' ? 'AI is Scoring Relevancy...' :
             'Processing...'}
          </h3>
          <p className="text-dark-muted text-xs font-mono mt-2">
            {step === 'fetching' ? 'Searching 5 titles × 3 results each' :
             step === 'scoring' ? 'AI is analyzing each job against your resume' :
             'Please wait...'}
          </p>
        </motion.div>
      )}

      {/* ─── EMPTY STATE ─── */}
      {!loading && sortedJobs.length === 0 && (
        <motion.div
          className="text-center py-20 bg-dark-card border border-dark-border rounded-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className="text-5xl">🎯</span>
          <h3 className="font-display font-bold text-xl mt-4">Ready to Find Matches</h3>
          <p className="text-dark-muted text-sm font-mono mt-2 max-w-sm mx-auto">
            Click "Fetch Latest Jobs" to search LinkedIn for your best-fit positions
          </p>
        </motion.div>
      )}

      {/* ─── JOB CARDS GRID ─── */}
      {!loading && sortedJobs.length > 0 && (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {sortedJobs.map((job, i) => (
            <AIJobCard
              key={job.id}
              job={job}
              index={i}
              onClick={() => setSelectedJob(job)}
              scoreColor={scoreColor}
              scoreLabel={scoreLabel}
            />
          ))}
        </motion.div>
      )}

      {/* ─── JOB DETAIL MODAL ─── */}
      <AnimatePresence>
        {selectedJob && (
          <ResumeRewriteModal
            job={selectedJob}
            sessionId={sessionId}
            onClose={() => setSelectedJob(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ─── Stat Card ─── */
function StatCard({ label, value, color }) {
  return (
    <motion.div
      className="bg-dark-card border border-dark-border rounded-2xl p-4 text-center group hover:border-accent/20 transition-colors"
      whileHover={{ y: -2 }}
    >
      <span
        className="font-mono font-bold text-2xl block"
        style={color ? { color } : undefined}
      >
        {value}
      </span>
      <span className="text-[10px] font-mono uppercase tracking-wider mt-1 block text-dark-muted">
        {label}
      </span>
    </motion.div>
  )
}

/* ─── AI Job Card ─── */
function AIJobCard({ job, index, onClick, scoreColor, scoreLabel }) {
  const score = job.relevancy_score
  const hasScore = score != null
  const reasons = Array.isArray(job.reasons) ? job.reasons : []

  return (
    <motion.div
      className="bg-dark-card border border-dark-border rounded-2xl p-5 cursor-pointer group hover:border-accent/25 transition-all relative overflow-hidden"
      onClick={onClick}
      variants={item}
      whileHover={{ y: -3, boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}
    >
      {/* Score badge — top right */}
      {hasScore && (
        <div className="absolute top-4 right-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center border-2"
            style={{ borderColor: scoreColor(score) }}
          >
            <span
              className="font-mono font-bold text-sm"
              style={{ color: scoreColor(score) }}
            >
              {score}
            </span>
          </div>
          <p
            className="text-[8px] font-mono text-center mt-0.5 uppercase font-bold"
            style={{ color: scoreColor(score) }}
          >
            {scoreLabel(score)}
          </p>
        </div>
      )}

      {/* Content */}
      <div className="pr-16">
        <h3 className="font-display font-bold text-sm leading-tight truncate group-hover:text-accent transition-colors">
          {job.title}
        </h3>
        <p className="text-dark-muted text-xs mt-1 truncate">{job.company}</p>
        {job.location && (
          <p className="text-dark-muted/60 text-[11px] mt-0.5 flex items-center gap-1">
            <span className="text-[9px]">📍</span>{job.location}
          </p>
        )}
      </div>

      {/* Tags row */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {job.salary && job.salary !== '' && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/5 text-emerald-400 border border-emerald-500/10">
            💰 {job.salary.length > 25 ? job.salary.slice(0, 23) + '…' : job.salary}
          </span>
        )}
        {job.salary_match && job.salary_match !== 'unknown' && (
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
            job.salary_match === 'true'
              ? 'bg-accent/5 text-accent border-accent/10'
              : 'bg-red-500/5 text-red-400 border-red-500/10'
          }`}>
            {job.salary_match === 'true' ? '✓ Salary' : '✗ Salary'}
          </span>
        )}
        {job.experience_match != null && (
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
            job.experience_match
              ? 'bg-accent/5 text-accent border-accent/10'
              : 'bg-orange-500/5 text-orange-400 border-orange-500/10'
          }`}>
            {job.experience_match ? '✓ Exp' : '✗ Exp'}
          </span>
        )}
      </div>

      {/* AI Summary */}
      {job.summary && (
        <p className="text-[11px] text-gray-400 mt-3 leading-relaxed line-clamp-2">
          {job.summary}
        </p>
      )}

      {/* Reasons preview */}
      {reasons.length > 0 && (
        <div className="mt-3 space-y-1">
          {reasons.slice(0, 2).map((r, i) => (
            <p key={i} className="text-[10px] text-dark-muted flex items-start gap-1.5">
              <span className="text-accent font-bold mt-px">•</span>
              <span className="line-clamp-1">{r}</span>
            </p>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-dark-border/40">
        <span className="text-[10px] font-mono text-dark-muted">
          {job.fetched_at ? new Date(job.fetched_at).toLocaleDateString() : '—'}
        </span>
        <span className="text-[11px] font-mono font-semibold text-accent group-hover:text-accent-dim transition-colors">
          View Details →
        </span>
      </div>
    </motion.div>
  )
}
