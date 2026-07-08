import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/**
 * Header for the public (logged-out) pages: landing, pricing, free tools,
 * legal. The in-app <Navbar> only renders for signed-in users.
 */
export default function PublicHeader() {
  const { user } = useAuth()

  return (
    <header className="sticky top-0 z-50 glass border-b border-dark-border/50">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/20 to-cyan/20 border border-accent/30 flex items-center justify-center">
            <span className="text-accent font-mono font-bold text-sm">◉</span>
          </div>
          <span className="font-display font-bold text-sm tracking-tight">
            JOB<span className="text-accent">HUNTER</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <NavLink
            to="/pricing"
            className="px-2.5 py-1.5 text-xs font-mono text-dark-muted hover:text-white transition-colors"
          >
            Pricing
          </NavLink>
          <NavLink
            to="/tools/resume-score"
            className="px-2.5 py-1.5 text-xs font-mono text-dark-muted hover:text-white transition-colors"
          >
            Free ATS Check
          </NavLink>
          {user ? (
            <Link
              to="/"
              className="ml-1 px-3.5 py-1.5 rounded-xl bg-accent/10 text-accent border border-accent/20 font-mono text-xs font-bold hover:bg-accent/20 transition-colors"
            >
              Open App →
            </Link>
          ) : (
            <Link
              to="/auth"
              className="ml-1 px-3.5 py-1.5 rounded-xl bg-accent/10 text-accent border border-accent/20 font-mono text-xs font-bold hover:bg-accent/20 transition-colors"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
