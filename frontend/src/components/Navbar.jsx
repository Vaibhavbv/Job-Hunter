import { useState, useRef, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { to: '/', label: 'Jobs', icon: '⬡' },
  { to: '/dashboard', label: 'Overview', icon: '◈' },
  { to: '/upload', label: 'Resume', icon: '📄' },
  { to: '/ai-dashboard', label: 'AI Match', icon: '🎯' },
  { to: '/tracker', label: 'Tracker', icon: '◫' },
  { to: '/analytics', label: 'Analytics', icon: '◩' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]

export default function Navbar() {
  const { theme, toggle } = useTheme()
  const { user, profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const menuRef = useRef(null)

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
    setShowUserMenu(false)
  }

  const userInitials = (profile?.full_name || user?.email || '?')
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')

  return (
    <motion.header
      className="sticky top-0 z-50 glass border-b border-dark-border/50"
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2 group">
          <motion.div
            className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/20 to-cyan/20 border border-accent/30 flex items-center justify-center"
            whileHover={{ scale: 1.05, rotate: 5 }}
          >
            <span className="text-accent font-mono font-bold text-sm">◉</span>
          </motion.div>
          <span className="font-display font-bold text-sm tracking-tight hidden sm:block">
            JOB<span className="text-accent">HUNTER</span>
          </span>
        </NavLink>

        {/* Nav Links */}
        <nav className="flex items-center gap-0.5">
          {navItems.map(item => {
            const isActive = location.pathname === item.to
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="relative px-2.5 py-1.5 text-xs font-mono transition-colors rounded-lg"
              >
                <span className={`${isActive ? 'text-accent' : 'text-dark-muted hover:text-white'} transition-colors`}>
                  <span className="mr-1 hidden lg:inline">{item.icon}</span>
                  {item.label}
                </span>
                {/* Animated underline for active link */}
                {isActive && (
                  <motion.div
                    className="absolute bottom-0 left-2 right-2 h-[2px] bg-gradient-to-r from-accent to-cyan rounded-full"
                    layoutId="nav-underline"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Right side: Theme + User */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <motion.button
            onClick={toggle}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-dark-muted hover:text-white hover:bg-dark-hover transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀' : '☽'}
          </motion.button>

          {/* User Avatar */}
          {user && (
            <div className="relative" ref={menuRef}>
              <motion.button
                onClick={() => setShowUserMenu(prev => !prev)}
                className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/30 to-violet/30 border border-accent/20 flex items-center justify-center text-white text-[11px] font-mono font-bold hover:border-accent/40 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {userInitials}
              </motion.button>

              {/* Dropdown Menu */}
              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    className="absolute right-0 top-full mt-2 w-56 bg-dark-card border border-dark-border rounded-xl overflow-hidden shadow-premium z-50"
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                  >
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-dark-border/50">
                      <p className="text-sm font-display font-bold truncate">
                        {profile?.full_name || 'User'}
                      </p>
                      <p className="text-[11px] font-mono text-dark-muted truncate">
                        {user.email}
                      </p>
                    </div>

                    {/* Menu items */}
                    <div className="py-1">
                      <button
                        onClick={() => { navigate('/settings'); setShowUserMenu(false) }}
                        className="w-full px-4 py-2 text-left text-sm font-mono text-dark-muted hover:text-white hover:bg-dark-hover transition-colors flex items-center gap-2"
                      >
                        <span>⚙</span> Settings
                      </button>
                      <button
                        onClick={handleSignOut}
                        className="w-full px-4 py-2 text-left text-sm font-mono text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors flex items-center gap-2"
                      >
                        <span>↪</span> Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </motion.header>
  )
}
