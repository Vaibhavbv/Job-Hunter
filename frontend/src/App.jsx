import { lazy, Suspense, useState, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import Navbar from './components/Navbar'
import SplashScreen from './components/SplashScreen'
import Toast, { ToastProvider } from './components/Toast'
import CommandPalette from './components/CommandPalette'
import { ThemeProvider } from './hooks/useTheme'
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'

// Lazy-loaded pages
const AuthPage = lazy(() => import('./pages/AuthPage'))
const JobsBoard = lazy(() => import('./pages/JobsBoard'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Tracker = lazy(() => import('./pages/Tracker'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Settings = lazy(() => import('./pages/Settings'))
const ResumeUpload = lazy(() => import('./pages/ResumeUpload'))
const AIDashboard = lazy(() => import('./pages/AIDashboard'))

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

  const isAuthPage = location.pathname === '/auth'

  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <div className="min-h-screen bg-dark-bg dark:bg-dark-bg relative">
            {/* Subtle noise overlay on all pages */}
            <div className="noise-overlay" />

            {/* Only show navbar when not on auth page */}
            {!isAuthPage && <Navbar />}
            {!isAuthPage && <CommandPalette />}

            <main className={isAuthPage ? '' : 'pt-4'}>
              <AnimatePresence mode="wait">
                <Suspense fallback={<PageLoader />} key={location.pathname}>
                  <Routes location={location}>
                    {/* Public route */}
                    <Route path="/auth" element={<AuthPage />} />

                    {/* Protected routes */}
                    <Route path="/" element={
                      <ProtectedRoute><JobsBoard /></ProtectedRoute>
                    } />
                    <Route path="/dashboard" element={
                      <ProtectedRoute><Dashboard /></ProtectedRoute>
                    } />
                    <Route path="/tracker" element={
                      <ProtectedRoute><Tracker /></ProtectedRoute>
                    } />
                    <Route path="/analytics" element={
                      <ProtectedRoute><Analytics /></ProtectedRoute>
                    } />
                    <Route path="/settings" element={
                      <ProtectedRoute><Settings /></ProtectedRoute>
                    } />
                    <Route path="/upload" element={
                      <ProtectedRoute><ResumeUpload /></ProtectedRoute>
                    } />
                    <Route path="/ai-dashboard" element={
                      <ProtectedRoute><AIDashboard /></ProtectedRoute>
                    } />
                  </Routes>
                </Suspense>
              </AnimatePresence>
            </main>
          </div>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
