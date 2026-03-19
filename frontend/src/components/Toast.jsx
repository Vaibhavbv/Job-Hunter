import { createContext, useContext, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'

const ToastContext = createContext()

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const success = useCallback((msg) => addToast(msg, 'success'), [addToast])
  const error = useCallback((msg) => addToast(msg, 'error'), [addToast])
  const info = useCallback((msg) => addToast(msg, 'info'), [addToast])

  return (
    <ToastContext.Provider value={{ addToast, success, error, info }}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

const typeStyles = {
  success: 'border-accent/40 bg-accent/5',
  error:   'border-red-500/40 bg-red-500/5',
  info:    'border-cold-blue/40 bg-cold-blue/5',
}

const typeIcons = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
}

const typeColors = {
  success: 'text-accent',
  error:   'text-red-400',
  info:    'text-cold-blue',
}

function ToastContainer({ toasts }) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            className={`pointer-events-auto glass border rounded-xl px-4 py-3 flex items-center gap-3 min-w-[280px] ${typeStyles[toast.type]}`}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <span className={`font-mono text-sm font-bold ${typeColors[toast.type]}`}>
              {typeIcons[toast.type]}
            </span>
            <span className="text-sm font-body">{toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export default function Toast() { return null } // placeholder for import
