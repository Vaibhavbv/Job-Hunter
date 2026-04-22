import { Component } from 'react'
import { motion } from 'motion/react'

/**
 * React Error Boundary — catches component-level crashes
 * and displays a recovery UI instead of a white screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-dark-bg flex items-center justify-center p-6">
          <motion.div
            className="max-w-md w-full bg-dark-card border border-dark-border rounded-2xl p-8 text-center"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <div className="text-5xl mb-4">💥</div>
            <h2 className="font-display font-bold text-xl mb-2">Something went wrong</h2>
            <p className="text-dark-muted text-sm font-mono mb-4">
              An unexpected error occurred. This has been logged.
            </p>
            {this.state.error?.message && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-6 text-left">
                <p className="text-red-400 text-xs font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <motion.button
                onClick={this.handleReset}
                className="px-5 py-2.5 rounded-xl bg-accent/10 text-accent border border-accent/20 font-mono text-sm font-bold"
                whileTap={{ scale: 0.95 }}
              >
                Try Again
              </motion.button>
              <motion.button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 rounded-xl bg-dark-hover text-dark-muted border border-dark-border font-mono text-sm"
                whileTap={{ scale: 0.95 }}
              >
                Reload Page
              </motion.button>
            </div>
          </motion.div>
        </div>
      )
    }

    return this.props.children
  }
}
