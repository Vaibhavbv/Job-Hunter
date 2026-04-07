import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useAuth } from '../hooks/useAuth'

const routes = [
  { name: 'Jobs Board', path: '/', icon: '⬡' },
  { name: 'Overview', path: '/dashboard', icon: '◈' },
  { name: 'Resume', path: '/upload', icon: '📄' },
  { name: 'AI Match', path: '/ai-dashboard', icon: '🎯' },
  { name: 'Tracker', path: '/tracker', icon: '◫' },
  { name: 'Analytics', path: '/analytics', icon: '◩' },
  { name: 'Settings', path: '/settings', icon: '⚙' },
]

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const { signOut } = useAuth()

  // Open with Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // All commands including sign out
  const allCommands = useMemo(() => [
    ...routes.map(r => ({ ...r, type: 'navigate' })),
    { name: 'Sign Out', path: null, icon: '↪', type: 'action', action: 'signout' },
  ], [])

  // Search results
  const filteredCommands = useMemo(() => {
    if (!query) return allCommands
    const q = query.toLowerCase()
    return allCommands.filter(r => r.name.toLowerCase().includes(q))
  }, [query, allCommands])

  const handleSelect = async (cmd) => {
    if (cmd.type === 'action' && cmd.action === 'signout') {
      await signOut()
      navigate('/auth')
    } else if (cmd.path) {
      navigate(cmd.path)
    }
    setOpen(false)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          {/* Palette */}
          <motion.div
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg z-[151] bg-dark-card border border-dark-border rounded-2xl overflow-hidden shadow-premium"
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            {/* Search input */}
            <div className="flex items-center px-4 border-b border-dark-border/50">
              <span className="text-dark-muted text-sm mr-2">⌘</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search pages, commands..."
                className="w-full py-3 bg-transparent text-sm font-mono outline-none placeholder:text-dark-muted"
                id="command-palette-input"
              />
              <kbd className="text-[10px] font-mono text-dark-muted bg-dark-bg px-1.5 py-0.5 rounded border border-dark-border">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-64 overflow-y-auto py-2">
              {filteredCommands.length === 0 ? (
                <div className="px-4 py-6 text-center text-dark-muted text-sm font-mono">
                  No results found
                </div>
              ) : (
                filteredCommands.map((item, i) => (
                  <motion.button
                    key={item.name}
                    onClick={() => handleSelect(item)}
                    className={`w-full px-4 py-2.5 flex items-center gap-3 hover:bg-dark-hover transition-colors text-left ${
                      item.action === 'signout' ? 'text-red-400 hover:text-red-300' : ''
                    }`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <span className={`font-mono text-sm ${item.action === 'signout' ? '' : 'text-accent'}`}>
                      {item.icon}
                    </span>
                    <span className="text-sm">{item.name}</span>
                  </motion.button>
                ))
              )}
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2 border-t border-dark-border/50 flex items-center gap-4 text-[10px] text-dark-muted font-mono">
              <span>↑↓ Navigate</span>
              <span>↵ Open</span>
              <span>ESC Close</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
