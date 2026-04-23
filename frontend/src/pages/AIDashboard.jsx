import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession'
import { useEvaluations } from '../hooks/useEvaluations'
import ResumeRewriteModal from '../components/ResumeRewriteModal'
import CreditBadge from '../components/CreditBadge'

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

const GRADE_COLORS = {
  'A+': '#00ff88', 'A': '#34d399', 'B+': '#60a5fa',
  'B': '#818cf8', 'C': '#fbbf24', 'D': '#f97316', 'F': '#ef4444',
}

const ARCHETYPE_STYLES = {
  'Dream Job':    { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', icon: '🌟' },
  'Strong Match': { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400', icon: '✅' },
  'Worth Trying': { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', icon: '🎯' },
  'Stretch':      { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', icon: '⚡' },
  'Mismatch':     { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', icon: '❌' },
  'Dealbreaker':  { bg: 'bg-gray-500/10', border: 'border-gray-500/20', text: 'text-gray-400', icon: '🚫' },
}

const RECOMMENDATION_TABS = [
  { key: 'all', label: 'All', icon: '📊' },
  { key: 'Apply Now', label: 'Apply Now', icon: '🚀' },
  { key: 'Worth Trying', label: 'Worth Trying', icon: '🎯' },
  { key: 'Maybe Later', label: 'Maybe Later', icon: '⏳' },
  { key: 'Skip', label: 'Skip', icon: '⏭️' },
]

export default function AIDashboard() {
  const navigate = useNavigate()
  const { sessionId, jobTitles, loading: sessionLoading, step, error: sessionError, clearSession } = useSession()
  const { evaluations, loading: evalsLoading, evaluating, stats, evaluate, progress, pendingCount } = useEvaluations()

  const [selectedEval, setSelectedEval] = useState(null)
  const [activeTab, setActiveTab] = useState('all')
  const [sortBy, setSortBy] = useState('score') // 'score' | 'grade' | 'archetype'

  // Filter evaluations by recommendation tab
  const filteredEvals = useMemo(() => {
    let filtered = [...evaluations]
    if (activeTab !== 'all') {
      filtered = filtered.filter(e => e.recommendation === activeTab)
    }
    // Sort
    if (sortBy === 'score') {
      filtered.sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0))
    } else if (sortBy === 'grade') {
      const order = ['A+', 'A', 'B+', 'B', 'C', 'D', 'F']
      filtered.sort((a, b) => order.indexOf(a.grade) - order.indexOf(b.grade))
    }
    return filtered
  }, [evaluations, activeTab, sortBy])

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts = { all: evaluations.length }
    for (const e of evaluations) {
      counts[e.recommendation] = (counts[e.recommendation] || 0) + 1
    }
    return counts
  }, [evaluations])

  const handleEvaluateAll = useCallback(async () => {
    try {
      await evaluate([], sessionId)
    } catch (err) {
      console.error('Evaluation failed:', err)
    }
  }, [evaluate, sessionId])

  const handleNewResume = () => {
    clearSession()
    navigate('/upload')
  }

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
            AI <span className="text-accent">Evaluations</span>
          </h1>
          <p className="text-dark-muted text-xs font-mono mt-1">
            5-dimension scoring · {evaluations.length} evaluated
            {pendingCount > 0 && (
              <span className="text-amber-400 ml-2">· {pendingCount} pending</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CreditBadge />
          <motion.button
            onClick={handleEvaluateAll}
            disabled={evaluating || evalsLoading}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent to-emerald-400 text-dark-bg font-mono text-sm font-bold hover:from-accent-dim hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-glow"
            whileTap={{ scale: 0.95 }}
          >
            {evaluating ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-dark-bg/30 border-t-dark-bg rounded-full animate-spin" />
                Evaluating... ({progress.current}/{progress.total || '?'})
              </span>
            ) : pendingCount > 0 ? (
              `⚡ Evaluate ${pendingCount} Pending`
            ) : (
              '✓ All Evaluated'
            )}
          </motion.button>
          {sessionId && (
            <motion.button
              onClick={handleNewResume}
              className="px-4 py-2.5 rounded-xl font-mono text-sm text-dark-muted border border-dark-border hover:border-accent/20 hover:text-white transition-all"
              whileTap={{ scale: 0.95 }}
            >
              ↑ New Resume
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* ─── JOB TITLES BAND ─── */}
      {jobTitles.length > 0 && (
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
      )}

      {/* ─── STATS ROW ─── */}
      {stats.total > 0 && (
        <motion.div variants={item} className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <MiniStat label="Evaluated" value={stats.total} accent />
          <MiniStat label="Avg Score" value={stats.avgScore} color={stats.avgScore >= 60 ? '#00ff88' : stats.avgScore >= 40 ? '#fbbf24' : '#ef4444'} />
          <MiniStat label="Apply Now" value={(tabCounts['Apply Now'] || 0)} color="#00ff88" />
          <MiniStat label="Worth Trying" value={(tabCounts['Worth Trying'] || 0)} color="#60a5fa" />
          <MiniStat label="Gate Fails" value={stats.gateFailCount} color="#ef4444" />
        </motion.div>
      )}

      {/* ─── ERROR ─── */}
      <AnimatePresence>
        {sessionError && (
          <motion.div
            className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm font-mono"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            ✗ {sessionError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── LOADING STATE ─── */}
      {evaluating && (
        <motion.div
          className="bg-dark-card border border-dark-border rounded-2xl p-6 mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-base">
              Batch Evaluation in Progress
            </h3>
            <span className="text-xs font-mono text-accent">
              {progress.current}/{progress.total || '?'}
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-2 bg-dark-bg rounded-full overflow-hidden mb-3">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-accent to-emerald-400"
              initial={{ width: 0 }}
              animate={{
                width: progress.total > 0
                  ? `${Math.min((progress.current / progress.total) * 100, 100)}%`
                  : '30%'
              }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <p className="text-dark-muted text-xs font-mono">
            {progress.message || 'AI is scoring each job across 5 dimensions against your profile...'}
          </p>
        </motion.div>
      )}

      {/* ─── FILTER TABS ─── */}
      {!evaluating && evaluations.length > 0 && (
        <motion.div variants={item} className="flex items-center gap-2 mb-6 flex-wrap">
          {RECOMMENDATION_TABS.map(tab => (
            <motion.button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono text-xs border transition-all ${
                activeTab === tab.key
                  ? 'bg-accent/10 text-accent border-accent/30'
                  : 'text-dark-muted border-dark-border/60 hover:border-accent/20 hover:text-white'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tabCounts[tab.key] !== undefined && (
                <span className={`text-[9px] font-bold ml-1 px-1.5 py-0.5 rounded ${
                  activeTab === tab.key ? 'bg-accent/20' : 'bg-dark-border/50'
                }`}>
                  {tabCounts[tab.key] || 0}
                </span>
              )}
            </motion.button>
          ))}

          {/* Sort toggle */}
          <div className="ml-auto flex items-center gap-1">
            <span className="text-[10px] font-mono text-dark-muted mr-1">Sort:</span>
            {[{ key: 'score', label: 'Score' }, { key: 'grade', label: 'Grade' }].map(s => (
              <button
                key={s.key}
                onClick={() => setSortBy(s.key)}
                className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                  sortBy === s.key ? 'bg-dark-hover text-white' : 'text-dark-muted hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* ─── EMPTY STATE ─── */}
      {!evaluating && !evalsLoading && evaluations.length === 0 && (
        <motion.div
          className="text-center py-20 bg-dark-card border border-dark-border rounded-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className="text-5xl">🎯</span>
          <h3 className="font-display font-bold text-xl mt-4">Ready to Evaluate</h3>
          <p className="text-dark-muted text-sm font-mono mt-2 max-w-sm mx-auto">
            {sessionId
              ? 'Click "Evaluate New Jobs" to score your scraped jobs with AI'
              : 'Upload your resume first, then evaluate jobs against your profile'}
          </p>
          {!sessionId && (
            <motion.button
              onClick={() => navigate('/upload')}
              className="mt-6 px-6 py-3 rounded-xl bg-gradient-to-r from-accent to-emerald-400 text-dark-bg font-mono text-sm font-bold"
              whileTap={{ scale: 0.95 }}
            >
              Upload Resume →
            </motion.button>
          )}
        </motion.div>
      )}

      {/* ─── EVALUATION CARDS GRID ─── */}
      {!evaluating && filteredEvals.length > 0 && (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {filteredEvals.map((evaluation) => (
            <EvaluationCard
              key={evaluation.id}
              evaluation={evaluation}
              onClick={() => setSelectedEval(evaluation)}
            />
          ))}
        </motion.div>
      )}

      {/* ─── JOB DETAIL MODAL ─── */}
      <AnimatePresence>
        {selectedEval && selectedEval.jobs && (
          <ResumeRewriteModal
            job={{
              id: selectedEval.jobs.id,
              title: selectedEval.jobs.title,
              company: selectedEval.jobs.company,
              location: selectedEval.jobs.location,
              salary: selectedEval.jobs.salary,
              url: selectedEval.jobs.url,
              jd_text: selectedEval.jobs.description,
              platform: selectedEval.jobs.platform,
              // Pass evaluation data for display
              evaluation: selectedEval,
            }}
            sessionId={sessionId}
            onClose={() => setSelectedEval(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ─── Mini Stat ─── */
function MiniStat({ label, value, color, accent }) {
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
      <span className={`text-[10px] font-mono uppercase tracking-wider mt-1 block ${accent ? 'text-accent' : 'text-dark-muted'}`}>
        {label}
      </span>
    </motion.div>
  )
}

/* ─── Evaluation Card ─── */
function EvaluationCard({ evaluation, onClick }) {
  const job = evaluation.jobs
  if (!job) return null

  const gradeColor = GRADE_COLORS[evaluation.grade] || '#8b8da3'
  const archStyle = ARCHETYPE_STYLES[evaluation.archetype] || ARCHETYPE_STYLES['Mismatch']
  const reasons = Array.isArray(evaluation.reasons) ? evaluation.reasons : []
  const risks = Array.isArray(evaluation.risks) ? evaluation.risks : []

  // Dimension bars
  const dimensions = [
    { key: 'technical_fit', label: 'Tech', value: evaluation.technical_fit, color: '#00ff88' },
    { key: 'seniority_fit', label: 'Seniority', value: evaluation.seniority_fit, color: '#60a5fa' },
    { key: 'domain_fit', label: 'Domain', value: evaluation.domain_fit, color: '#818cf8' },
    { key: 'salary_fit', label: 'Salary', value: evaluation.salary_fit, color: '#fbbf24' },
    { key: 'location_fit', label: 'Location', value: evaluation.location_fit, color: '#f472b6' },
  ]

  return (
    <motion.div
      className="bg-dark-card border border-dark-border rounded-2xl p-5 cursor-pointer group hover:border-accent/25 transition-all relative overflow-hidden"
      onClick={onClick}
      variants={item}
      whileHover={{ y: -3, boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}
    >
      {/* Gate fail warning stripe */}
      {evaluation.gate_fail && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 to-orange-500" />
      )}

      {/* Score badge — top right */}
      <div className="absolute top-4 right-4 text-right">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center border-2"
          style={{ borderColor: gradeColor }}
        >
          <span className="font-mono font-bold text-sm" style={{ color: gradeColor }}>
            {evaluation.overall_score}
          </span>
        </div>
        <p className="text-[9px] font-mono text-center mt-0.5 uppercase font-bold" style={{ color: gradeColor }}>
          {evaluation.grade}
        </p>
      </div>

      {/* Content */}
      <div className="pr-16">
        <h3 className="font-display font-bold text-sm leading-tight truncate group-hover:text-accent transition-colors">
          {job.title}
        </h3>
        <p className="text-dark-muted text-xs mt-1 truncate">{job.company}</p>
        {job.location && (
          <p className="text-dark-muted/60 text-[11px] mt-0.5">📍 {job.location}</p>
        )}
      </div>

      {/* Archetype + Recommendation badges */}
      <div className="flex items-center gap-2 mt-3">
        <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border ${archStyle.bg} ${archStyle.border} ${archStyle.text}`}>
          {archStyle.icon} {evaluation.archetype}
        </span>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
          evaluation.recommendation === 'Apply Now'
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : evaluation.recommendation === 'Worth Trying'
            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
            : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
        }`}>
          {evaluation.recommendation}
        </span>
      </div>

      {/* Dimension mini bars */}
      <div className="mt-3 space-y-1.5">
        {dimensions.map(dim => (
          <div key={dim.key} className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-dark-muted w-16 shrink-0">{dim.label}</span>
            <div className="flex-1 h-1.5 bg-dark-bg rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: dim.color }}
                initial={{ width: 0 }}
                animate={{ width: `${dim.value || 0}%` }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span className="text-[9px] font-mono text-dark-muted w-6 text-right">{dim.value}</span>
          </div>
        ))}
      </div>

      {/* AI Summary */}
      {evaluation.summary && (
        <p className="text-[11px] text-gray-400 mt-3 leading-relaxed line-clamp-2">
          {evaluation.summary}
        </p>
      )}

      {/* Reasons preview */}
      {reasons.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {reasons.slice(0, 2).map((r, i) => (
            <p key={i} className="text-[10px] text-dark-muted flex items-start gap-1.5">
              <span className="text-accent font-bold mt-px">+</span>
              <span className="line-clamp-1">{r}</span>
            </p>
          ))}
        </div>
      )}

      {/* Risks preview */}
      {risks.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {risks.slice(0, 1).map((r, i) => (
            <p key={i} className="text-[10px] text-red-400/70 flex items-start gap-1.5">
              <span className="text-red-400 font-bold mt-px">−</span>
              <span className="line-clamp-1">{r}</span>
            </p>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-dark-border/40">
        <span className="text-[10px] font-mono text-dark-muted">
          {job.platform} · {job.posted_date || '—'}
        </span>
        <span className="text-[11px] font-mono font-semibold text-accent group-hover:text-accent-dim transition-colors">
          Details →
        </span>
      </div>
    </motion.div>
  )
}
