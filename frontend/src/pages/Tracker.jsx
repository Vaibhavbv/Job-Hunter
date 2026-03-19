import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTracker } from '../hooks/useTracker'
import { useJobs } from '../hooks/useJobs'
import confetti from 'canvas-confetti'

const STATUS_COLORS = {
  Applied:   { bg: 'bg-cold-blue/10', border: 'border-cold-blue/20', text: 'text-cold-blue', dot: 'bg-cold-blue' },
  Interview: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  Offer:     { bg: 'bg-accent/10', border: 'border-accent/20', text: 'text-accent', dot: 'bg-accent' },
  Rejected:  { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', dot: 'bg-red-400' },
}

export default function Tracker() {
  const { columns, columnNames, addApplication, moveApplication, removeApplication } = useTracker()
  const { allJobs } = useJobs()
  const [showAddModal, setShowAddModal] = useState(false)
  const [draggedApp, setDraggedApp] = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)

  // Simple HTML5 drag and drop
  const handleDragStart = (app) => setDraggedApp(app)

  const handleDragOver = (e, col) => {
    e.preventDefault()
    setDragOverCol(col)
  }

  const handleDrop = useCallback((col) => {
    if (draggedApp && draggedApp.status !== col) {
      moveApplication(draggedApp.id, col)
      // Confetti burst for Offer column!
      if (col === 'Offer') {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00ff88', '#4fc3f7', '#fbbf24'],
        })
      }
    }
    setDraggedApp(null)
    setDragOverCol(null)
  }, [draggedApp, moveApplication])

  return (
    <motion.div
      className="max-w-7xl mx-auto px-4 sm:px-6 pb-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <motion.div
        className="flex items-center justify-between py-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="font-display font-bold text-2xl tracking-tight">
            Application <span className="text-accent">Tracker</span>
          </h1>
          <p className="text-dark-muted text-xs font-mono mt-1">
            Drag cards between columns to update status
          </p>
        </div>
        <motion.button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-xl bg-accent/10 text-accent border border-accent/20 font-mono text-xs font-bold hover:bg-accent/20 transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          + Add Application
        </motion.button>
      </motion.div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {columnNames.map((col, colIdx) => {
          const colors = STATUS_COLORS[col]
          const apps = columns[col] || []
          return (
            <motion.div
              key={col}
              className={`rounded-2xl border p-3 min-h-[300px] transition-colors ${
                dragOverCol === col
                  ? `${colors.bg} ${colors.border}`
                  : 'bg-dark-card border-dark-border'
              }`}
              onDragOver={(e) => handleDragOver(e, col)}
              onDrop={() => handleDrop(col)}
              onDragLeave={() => setDragOverCol(null)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: colIdx * 0.1 }}
            >
              {/* Column Header */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                <h3 className={`font-mono text-xs font-bold uppercase tracking-wider ${colors.text}`}>
                  {col}
                </h3>
                <span className="text-dark-muted text-[10px] font-mono ml-auto">
                  {apps.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-2">
                <AnimatePresence>
                  {apps.map(app => (
                    <motion.div
                      key={app.id}
                      draggable
                      onDragStart={() => handleDragStart(app)}
                      className="bg-dark-bg border border-dark-border rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-accent/20 transition-colors group"
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      whileHover={{ y: -2 }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium truncate">
                            {app.jobs?.title || app.title || 'Unknown Role'}
                          </p>
                          <p className="text-[10px] text-dark-muted mt-0.5">
                            {app.jobs?.company || app.company || 'Unknown'}
                          </p>
                        </div>
                        <motion.button
                          onClick={() => removeApplication(app.id)}
                          className="text-dark-muted hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          whileTap={{ scale: 0.8 }}
                        >
                          ✕
                        </motion.button>
                      </div>
                      {app.notes && (
                        <p className="text-[10px] text-dark-muted/60 mt-2 italic truncate">
                          {app.notes}
                        </p>
                      )}
                      <p className="text-[9px] text-dark-muted/40 font-mono mt-2">
                        {app.applied_date ? new Date(app.applied_date).toLocaleDateString() : ''}
                      </p>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {apps.length === 0 && (
                  <div className="text-center py-8 text-dark-muted/40 text-xs font-mono">
                    Drop cards here
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddApplicationModal
            jobs={allJobs}
            onAdd={(jobId, notes) => {
              addApplication(jobId, 'Applied', notes)
              setShowAddModal(false)
            }}
            onClose={() => setShowAddModal(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ─── Add Application Modal ─────────────────────────── */
function AddApplicationModal({ jobs, onAdd, onClose }) {
  const [search, setSearch] = useState('')
  const [selectedJob, setSelectedJob] = useState(null)
  const [notes, setNotes] = useState('')

  const filtered = jobs.filter(j =>
    (j.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (j.company || '').toLowerCase().includes(search.toLowerCase())
  ).slice(0, 10)

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-md z-[81] bg-dark-card border border-dark-border rounded-2xl overflow-hidden"
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <div className="p-5">
          <h3 className="font-display font-bold text-lg mb-4">Track Application</h3>

          {!selectedJob ? (
            <>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search for a job to track..."
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-xl text-sm font-mono outline-none focus:border-accent/40 mb-3"
                autoFocus
              />
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filtered.map(job => (
                  <button
                    key={job.id}
                    onClick={() => setSelectedJob(job)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-dark-hover transition-colors"
                  >
                    <p className="text-sm truncate">{job.title}</p>
                    <p className="text-[10px] text-dark-muted">{job.company}</p>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="bg-dark-bg border border-dark-border rounded-xl p-3 mb-3">
                <p className="text-sm font-medium">{selectedJob.title}</p>
                <p className="text-[10px] text-dark-muted">{selectedJob.company}</p>
              </div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Notes (optional)..."
                rows={3}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-xl text-sm font-mono outline-none focus:border-accent/40 resize-none mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedJob(null)}
                  className="flex-1 py-2 rounded-xl border border-dark-border text-sm font-mono text-dark-muted hover:text-white transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => onAdd(selectedJob.id, notes)}
                  className="flex-1 py-2 rounded-xl bg-accent text-dark-bg text-sm font-mono font-bold hover:bg-accent-dim transition-colors"
                >
                  Track It
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </>
  )
}
