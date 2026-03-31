import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { useTheme } from '../hooks/useTheme'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '◈' },
  { to: '/jobs', label: 'Jobs', icon: '⬡' },
  { to: '/upload', label: 'Resume', icon: '📄' },
  { to: '/ai-dashboard', label: 'AI Match', icon: '🎯' },
  { to: '/tracker', label: 'Tracker', icon: '◫' },
  { to: '/analytics', label: 'Analytics', icon: '◩' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
]

export default function Navbar() {
  const { theme, toggle } = useTheme()
  const location = useLocation()

  return (
    <motion.header
      className="sticky top-0 z-50 glass border-b border-dark-border/50"
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2 group">
          <motion.span
            className="text-accent font-mono font-bold text-lg"
            whileHover={{ scale: 1.05 }}
          >
            ◉
          </motion.span>
          <span className="font-display font-bold text-sm tracking-tight hidden sm:block">
            JOB<span className="text-accent">HUNTER</span>
          </span>
        </NavLink>

        {/* Nav Links */}
        <nav className="flex items-center gap-1">
          {navItems.map(item => {
            const isActive = location.pathname === item.to
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="relative px-3 py-1.5 text-xs font-mono transition-colors"
              >
                <span className={`${isActive ? 'text-accent' : 'text-dark-muted hover:text-white'}`}>
                  <span className="mr-1 hidden lg:inline">{item.icon}</span>
                  {item.label}
                </span>
                {/* Animated underline for active link */}
                {isActive && (
                  <motion.div
                    className="absolute bottom-0 left-2 right-2 h-[2px] bg-accent rounded-full"
                    layoutId="nav-underline"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
              </NavLink>
            )
          })}
        </nav>

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
      </div>
    </motion.header>
  )
}
