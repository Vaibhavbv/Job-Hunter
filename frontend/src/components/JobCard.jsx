import { useRef, useMemo } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'

// Generate a stable color from company name
function hashColor(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = Math.abs(hash) % 360
  return `hsl(${h}, 55%, 45%)`
}

function initials(name) {
  return name.split(/[\s&,]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

const platformColors = {
  LinkedIn: 'bg-linkedin/10 text-linkedin border-linkedin/20',
  Naukri:   'bg-naukri/10 text-naukri border-naukri/20',
  Indeed:   'bg-indeed/10 text-indeed border-indeed/20',
}

/**
 * JobCard with subtle 3D tilt on hover using useMotionValue + rotateX/Y (max 8deg).
 * A moving glossy light reflection follows the cursor.
 */
export default function JobCard({ job, onBookmark, isBookmarked, onClick, index = 0 }) {
  const cardRef = useRef(null)

  // Motion values for 3D tilt effect
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  // Spring-smoothed rotation (max 8 degrees)
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [8, -8]), { stiffness: 200, damping: 20 })
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-8, 8]), { stiffness: 200, damping: 20 })

  // Glossy light position
  const lightX = useTransform(mouseX, [-0.5, 0.5], ['0%', '100%'])
  const lightY = useTransform(mouseY, [-0.5, 0.5], ['0%', '100%'])

  const handleMouseMove = (e) => {
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return
    // Normalize to -0.5 to 0.5.
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5)
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5)
  }

  const handleMouseLeave = () => {
    mouseX.set(0)
    mouseY.set(0)
  }

  const color = useMemo(() => hashColor(job.company || ''), [job.company])
  const letters = useMemo(() => initials(job.company || '?'), [job.company])

  const truncate = (str, len) => str?.length > len ? str.slice(0, len) + '…' : str || ''

  return (
    <motion.div
      ref={cardRef}
      className="relative bg-dark-card border border-dark-border rounded-2xl p-5 cursor-pointer group overflow-hidden"
      style={{ rotateX, rotateY, transformPerspective: 800 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => onClick?.(job)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ borderColor: 'rgba(0, 255, 136, 0.3)' }}
    >
      {/* Glossy light reflection overlay */}
      <motion.div
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: useTransform(
            [lightX, lightY],
            ([x, y]) => `radial-gradient(circle at ${x} ${y}, rgba(255,255,255,0.06) 0%, transparent 60%)`
          ),
        }}
      />

      <div className="relative z-10">
        {/* Top row: Logo + Info */}
        <div className="flex gap-3 items-start">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: color }}
          >
            {letters}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-bold text-sm leading-tight truncate" title={job.title}>
              {truncate(job.title, 50)}
            </h3>
            <p className="text-dark-muted text-xs mt-0.5 truncate">{job.company}</p>
            {job.location && (
              <p className="text-dark-muted/60 text-[11px] mt-0.5 flex items-center gap-1">
                <span className="text-[9px]">📍</span>{truncate(job.location, 35)}
              </p>
            )}
          </div>

          {/* Bookmark button */}
          {onBookmark && (
            <motion.button
              onClick={(e) => { e.stopPropagation(); onBookmark(job) }}
              className="text-dark-muted hover:text-accent transition-colors"
              whileTap={{ scale: 1.3 }}
            >
              <motion.span
                animate={isBookmarked ? { scale: [1, 1.4, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                {isBookmarked ? '♥' : '♡'}
              </motion.span>
            </motion.button>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border ${platformColors[job.platform] || 'bg-dark-hover text-dark-muted border-dark-border'}`}>
            {job.platform}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-accent/5 text-accent border border-accent/10">
            {job.role_type}
          </span>
          {job.salary && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/5 text-emerald-400 border border-emerald-500/10">
              💰 {truncate(job.salary, 25)}
            </span>
          )}
        </div>

        {/* Bottom: date + apply */}
        <div className="flex items-center justify-between mt-4">
          <span className="text-[10px] font-mono text-dark-muted">
            {job.posted_date ? formatDate(job.posted_date) : '—'}
          </span>
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-[11px] font-mono font-semibold text-accent hover:text-accent-dim transition-colors"
            >
              Apply →
            </a>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today - d) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff}d ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
