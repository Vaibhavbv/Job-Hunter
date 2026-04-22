import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import * as api from '../services/api'
import { scoreColor } from '../utils/format'

export default function ResumeRewriteModal({ job, sessionId, onClose }) {
  const [rewrittenResume, setRewrittenResume] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showRewrite, setShowRewrite] = useState(false)

  const handleRewrite = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.rewriteResume(sessionId, { job_id: job.id })
      setRewrittenResume(data.rewritten_resume)
      setShowRewrite(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([rewrittenResume], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `resume_tailored_${job.company.replace(/\s+/g, '_')}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const reasons = Array.isArray(job.reasons) ? job.reasons : []

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[80]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        className="fixed inset-4 sm:inset-x-auto sm:top-[4%] sm:bottom-[4%] sm:max-w-4xl sm:mx-auto z-[81] bg-dark-card border border-dark-border rounded-2xl overflow-hidden flex flex-col"
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-dark-border">
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-bold text-xl truncate">{job.title}</h2>
            <p className="text-dark-muted text-base mt-1">{job.company}</p>
            {job.location && <p className="text-dark-muted/60 text-sm mt-0.5">📍 {job.location}</p>}
          </div>

          {/* Score circle */}
          {job.relevancy_score != null && (
            <div className="flex flex-col items-center mr-4">
              <div
                className="relative w-16 h-16 rounded-full flex items-center justify-center border-[3px]"
                style={{ borderColor: scoreColor(job.relevancy_score) }}
              >
                <span
                  className="font-mono font-bold text-lg"
                  style={{ color: scoreColor(job.relevancy_score) }}
                >
                  {job.relevancy_score}
                </span>
              </div>
              <span className="text-[9px] font-mono text-dark-muted mt-1 uppercase">Match</span>
            </div>
          )}

          <motion.button
            onClick={onClose}
            className="text-dark-muted hover:text-white text-xl font-mono p-1"
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
          >
            ✕
          </motion.button>
        </div>

        {/* Relevancy Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4 border-b border-dark-border/50">
          <MiniStat
            label="Relevancy"
            value={job.relevancy_score != null ? `${job.relevancy_score}/100` : '—'}
            highlight
            color={job.relevancy_score != null ? scoreColor(job.relevancy_score) : undefined}
          />
          <MiniStat
            label="Salary Match"
            value={job.salary_match === 'true' ? '✓ Yes' : job.salary_match === 'false' ? '✗ No' : '? Unknown'}
            highlight={job.salary_match === 'true'}
          />
          <MiniStat
            label="Experience"
            value={job.experience_match === true ? '✓ Match' : job.experience_match === false ? '✗ Mismatch' : '—'}
            highlight={job.experience_match === true}
          />
          <MiniStat
            label="Salary"
            value={job.salary || 'Not listed'}
            highlight={!!job.salary}
          />
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* AI Summary */}
          {job.summary && (
            <div className="bg-accent/5 border border-accent/10 rounded-xl p-4">
              <h4 className="font-mono text-[10px] text-accent uppercase tracking-wider font-bold mb-2">
                AI Summary
              </h4>
              <p className="text-sm text-gray-300 leading-relaxed">{job.summary}</p>
            </div>
          )}

          {/* Top Reasons */}
          {reasons.length > 0 && (
            <div>
              <h4 className="font-mono text-[10px] text-dark-muted uppercase tracking-wider font-bold mb-3">
                Key Match Factors
              </h4>
              <div className="space-y-2">
                {reasons.map((reason, i) => (
                  <motion.div
                    key={i}
                    className="flex items-start gap-3 text-sm text-gray-300 bg-dark-bg rounded-xl p-3"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <span className="text-accent font-bold font-mono text-xs mt-0.5">{i + 1}</span>
                    <span className="leading-relaxed">{reason}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Job Description */}
          <div>
            <h4 className="font-mono text-[10px] text-dark-muted uppercase tracking-wider font-bold mb-3">
              Job Description
            </h4>
            <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap bg-dark-bg rounded-xl p-4 max-h-[300px] overflow-y-auto">
              {job.jd_text || 'No description available. Click the portal link to view on the original platform.'}
            </div>
          </div>

          {/* Rewritten Resume Section */}
          <AnimatePresence>
            {showRewrite && rewrittenResume && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-mono text-[10px] text-accent uppercase tracking-wider font-bold">
                    Tailored Resume
                  </h4>
                  <motion.button
                    onClick={handleDownload}
                    className="px-4 py-2 rounded-xl bg-accent/10 text-accent border border-accent/20 font-mono text-xs font-bold hover:bg-accent/20 transition-colors"
                    whileTap={{ scale: 0.95 }}
                  >
                    ↓ Download .txt
                  </motion.button>
                </div>
                <textarea
                  value={rewrittenResume}
                  onChange={e => setRewrittenResume(e.target.value)}
                  className="w-full h-[400px] bg-dark-bg border border-dark-border rounded-xl p-4 text-sm text-gray-300 font-mono leading-relaxed resize-none outline-none focus:border-accent/30 transition-colors"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm font-mono">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-dark-border flex items-center gap-3">
          {!showRewrite && (
            <motion.button
              onClick={handleRewrite}
              disabled={loading}
              className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-display font-bold text-base hover:from-violet-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              whileTap={{ scale: 0.98 }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Tailoring resume...
                </span>
              ) : (
                '✦ Tailor my resume for this role'
              )}
            </motion.button>
          )}
          {job.portal_url && (
            <a
              href={job.portal_url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${showRewrite ? 'flex-1' : ''} text-center py-3.5 px-6 rounded-xl bg-accent text-dark-bg font-display font-bold text-base hover:bg-accent-dim transition-colors`}
            >
              Apply Now →
            </a>
          )}
        </div>
      </motion.div>
    </>
  )
}

function MiniStat({ label, value, highlight, color }) {
  return (
    <div className="bg-dark-bg rounded-xl p-3 text-center">
      <p className="text-[10px] font-mono text-dark-muted uppercase tracking-wider mb-1">{label}</p>
      <p
        className={`text-sm font-bold truncate ${highlight && !color ? 'text-accent' : !color ? '' : ''}`}
        style={color ? { color } : undefined}
      >
        {value}
      </p>
    </div>
  )
}
