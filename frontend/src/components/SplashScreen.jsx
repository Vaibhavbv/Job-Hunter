import { motion } from 'motion/react'

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-dark-bg z-[200] flex items-center justify-center overflow-hidden">
      {/* Background orbs */}
      <div className="auth-bg-orbs">
        <motion.div
          className="auth-orb auth-orb-1"
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 3, ease: 'easeInOut' }}
        />
        <motion.div
          className="auth-orb auth-orb-2"
          animate={{ scale: [1, 0.8, 1], opacity: [0.3, 0.4, 0.3] }}
          transition={{ duration: 3.5, ease: 'easeInOut' }}
        />
      </div>

      <motion.div
        className="flex flex-col items-center gap-5 relative z-10"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Logo mark */}
        <motion.div
          className="relative"
          initial={{ rotate: -180, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent/20 via-emerald-500/10 to-cyan-500/20 border border-accent/30 flex items-center justify-center shadow-glow">
            <span className="text-accent text-4xl font-mono font-bold">◉</span>
          </div>
          {/* Pulse rings */}
          <motion.div
            className="absolute inset-0 rounded-2xl border border-accent/40"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 1.2, repeat: 1, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute inset-0 rounded-2xl border border-accent/20"
            initial={{ scale: 1, opacity: 0.3 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 1.5, repeat: 1, ease: 'easeOut', delay: 0.2 }}
          />
        </motion.div>

        {/* Text */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <h1 className="font-display font-bold text-2xl tracking-tight">
            JOB<span className="gradient-text">HUNTER</span>
          </h1>
          <p className="text-dark-muted text-xs font-mono mt-1">Intelligence Terminal v2.0</p>
        </motion.div>

        {/* Loading bar */}
        <motion.div
          className="w-40 h-1 bg-dark-border rounded-full overflow-hidden mt-1"
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'var(--gradient-accent)' }}
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          />
        </motion.div>
      </motion.div>
    </div>
  )
}
