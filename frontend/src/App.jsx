import { lazy, Suspense, useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import Navbar from './components/Navbar'
import SplashScreen from './components/SplashScreen'
import Toast, { ToastProvider } from './components/Toast'
import CommandPalette from './components/CommandPalette'
import { ThemeProvider } from './hooks/useTheme'

// Lazy-loaded pages
const Dashboard = lazy(() => import('./pages/Dashboard'))
const JobsBoard = lazy(() => import('./pages/JobsBoard'))
const Tracker = lazy(() => import('./pages/Tracker'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Settings = lazy(() => import('./pages/Settings'))

// Loading fallback with shimmer
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-dark-border border-t-accent rounded-full animate-spin" />
        <span className="text-dark-muted font-mono text-sm">Loading module...</span>
      </div>
    </div>
  )
}

export default function App() {
  const location = useLocation()
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1800)
    return () => clearTimeout(timer)
  }, [])

  if (showSplash) {
    return <SplashScreen />
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <div className="min-h-screen bg-dark-bg dark:bg-dark-bg relative">
          <Navbar />
          <CommandPalette />
          <main className="pt-4">
            <AnimatePresence mode="wait">
              <Suspense fallback={<PageLoader />} key={location.pathname}>
                <Routes location={location}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/jobs" element={<JobsBoard />} />
                  <Route path="/tracker" element={<Tracker />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </Suspense>
            </AnimatePresence>
          </main>
        </div>
      </ToastProvider>
    </ThemeProvider>
  )
}
