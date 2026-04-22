import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import * as api from '../services/api'

export default function CreditBadge() {
  const [credits, setCredits] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await api.checkCredits()
        if (data) setCredits(data)
      } catch {
        // silent fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading || !credits) return null

  const { estimated_runs, remaining_percent } = credits
  const colorClass =
    remaining_percent > 60
      ? 'text-accent border-accent/20 bg-accent/5'
      : remaining_percent > 25
      ? 'text-yellow-400 border-yellow-400/20 bg-yellow-400/5'
      : 'text-red-400 border-red-400/20 bg-red-400/5'

  return (
    <AnimatePresence>
      <motion.div
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[11px] border ${colorClass}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        title={`$${credits.used} / $${credits.limit} used this month`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-dot" />
        ~{estimated_runs} runs left
      </motion.div>
    </AnimatePresence>
  )
}
