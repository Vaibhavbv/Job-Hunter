import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function AuthPage() {
  const navigate = useNavigate()
  const { signIn, signUp, user } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  if (user) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        if (!fullName.trim()) {
          throw new Error('Please enter your full name')
        }
        await signUp(email, password, fullName)
        setSuccess('Account created! You can now sign in.')
        setMode('signin')
        setPassword('')
      } else {
        await signIn(email, password)
        navigate('/', { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = useCallback(() => {
    setMode(prev => prev === 'signin' ? 'signup' : 'signin')
    setError('')
    setSuccess('')
  }, [])

  return (
    <div className="min-h-screen bg-dark-bg relative overflow-hidden flex items-center justify-center px-4">
      {/* Animated background orbs */}
      <div className="auth-bg-orbs">
        <motion.div
          className="auth-orb auth-orb-1"
          animate={{
            x: [0, 80, -40, 0],
            y: [0, -60, 40, 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="auth-orb auth-orb-2"
          animate={{
            x: [0, -60, 30, 0],
            y: [0, 50, -80, 0],
            scale: [1, 0.8, 1.3, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="auth-orb auth-orb-3"
          animate={{
            x: [0, 40, -60, 0],
            y: [0, -40, 60, 0],
            scale: [1, 1.1, 0.85, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Noise overlay */}
      <div className="noise-overlay" />

      {/* Grid pattern */}
      <div className="fixed inset-0 grid-pattern opacity-30 pointer-events-none" />

      {/* Auth Card */}
      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Logo */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <motion.div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 via-emerald-500/10 to-cyan-500/20 border border-accent/30 mb-4"
            whileHover={{ scale: 1.05, rotate: 5 }}
          >
            <span className="text-accent text-3xl font-mono font-bold">◉</span>
          </motion.div>
          <h1 className="font-display font-bold text-2xl tracking-tight">
            JOB<span className="text-accent">HUNTER</span>
          </h1>
          <p className="text-dark-muted text-xs font-mono mt-1">
            Intelligence Terminal v2.0
          </p>
        </motion.div>

        {/* Card */}
        <div className="auth-card rounded-2xl p-8">
          {/* Tab Switcher */}
          <div className="flex items-center gap-1 p-1 bg-dark-bg/80 rounded-xl mb-6">
            {['signin', 'signup'].map(m => (
              <motion.button
                key={m}
                onClick={() => { setMode(m); setError(''); setSuccess('') }}
                className={`flex-1 py-2.5 rounded-lg font-mono text-sm font-semibold transition-all ${
                  mode === m
                    ? 'bg-dark-card text-white shadow-lg'
                    : 'text-dark-muted hover:text-white'
                }`}
                whileTap={{ scale: 0.97 }}
              >
                {m === 'signin' ? 'Sign In' : 'Sign Up'}
              </motion.button>
            ))}
          </div>

          {/* Form */}
          <AnimatePresence mode="wait">
            <motion.form
              key={mode}
              onSubmit={handleSubmit}
              className="space-y-4"
              initial={{ opacity: 0, x: mode === 'signup' ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: mode === 'signup' ? -20 : 20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Full Name (signup only) */}
              {mode === 'signup' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <label className="block text-[11px] font-mono text-dark-muted uppercase tracking-wider mb-2 font-semibold">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="premium-input w-full"
                    required
                    id="auth-fullname"
                  />
                </motion.div>
              )}

              {/* Email */}
              <div>
                <label className="block text-[11px] font-mono text-dark-muted uppercase tracking-wider mb-2 font-semibold">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="premium-input w-full"
                  required
                  id="auth-email"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-[11px] font-mono text-dark-muted uppercase tracking-wider mb-2 font-semibold">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="premium-input w-full"
                  required
                  minLength={6}
                  id="auth-password"
                />
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm font-mono"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    ✗ {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Success */}
              <AnimatePresence>
                {success && (
                  <motion.div
                    className="bg-accent/10 border border-accent/20 rounded-xl p-3 text-accent text-sm font-mono"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    ✓ {success}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={loading}
                className="premium-btn w-full py-3.5 rounded-xl font-display font-bold text-base"
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.span
                      className="w-4 h-4 border-2 border-dark-bg/30 border-t-dark-bg rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                    {mode === 'signin' ? 'Signing in...' : 'Creating account...'}
                  </span>
                ) : (
                  mode === 'signin' ? 'Sign In →' : 'Create Account →'
                )}
              </motion.button>
            </motion.form>
          </AnimatePresence>

          {/* Footer */}
          <div className="mt-6 text-center">
            <button
              onClick={toggleMode}
              className="text-sm font-mono text-dark-muted hover:text-accent transition-colors"
            >
              {mode === 'signin'
                ? "Don't have an account? Sign Up"
                : 'Already have an account? Sign In'
              }
            </button>
          </div>
        </div>

        {/* Bottom branding */}
        <motion.p
          className="text-center text-[10px] font-mono text-dark-muted/40 mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Powered by AI · Built with ♥
        </motion.p>
      </motion.div>
    </div>
  )
}
