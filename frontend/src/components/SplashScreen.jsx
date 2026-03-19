import { motion } from 'motion/react'

export default function SplashScreen() {
  return (
    <div className="fixed inset-0 bg-dark-bg z-[200] flex items-center justify-center">
      <motion.div
        className="flex flex-col items-center gap-4"
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
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-cold-blue/20 border border-accent/30 flex items-center justify-center">
            <span className="text-accent text-3xl font-mono font-bold">◉</span>
          </div>
          {/* Pulse ring */}
          <motion.div
            className="absolute inset-0 rounded-2xl border border-accent/40"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 1.2, repeat: 1, ease: 'easeOut' }}
          />
        </motion.div>

        {/* Text */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <h1 className="font-display font-bold text-xl tracking-tight">
            JOB<span className="text-accent">HUNTER</span>
          </h1>
          <p className="text-dark-muted text-xs font-mono mt-1">Intelligence Terminal v2.0</p>
        </motion.div>

        {/* Loading bar */}
        <motion.div
          className="w-32 h-0.5 bg-dark-border rounded-full overflow-hidden mt-2"
        >
          <motion.div
            className="h-full bg-accent rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          />
        </motion.div>
      </motion.div>
    </div>
  )
}
