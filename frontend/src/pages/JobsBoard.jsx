import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { FixedSizeList as List } from 'react-window'
import { useJobs } from '../hooks/useJobs'
import { useAuth } from '../hooks/useAuth'
import { useEvaluations } from '../hooks/useEvaluations'
import AnimatedCounter from '../components/AnimatedCounter'
import { hashColor, initials, formatDate, formatSalary } from '../utils/format'

const GRADE_COLORS = {
  'A+': '#00ff88', 'A': '#34d399', 'B+': '#60a5fa',
  'B': '#818cf8', 'C': '#fbbf24', 'D': '#f97316', 'F': '#ef4444',
}

const GRADE_OPTIONS = [
  { value: null, label: 'All Grades' },
  { value: 'A+', label: 'A+' }, { value: 'A', label: 'A' },
  { value: 'B+', label: 'B+' }, { value: 'B', label: 'B' },
  { value: 'C', label: 'C' }, { value: 'D', label: 'D' }, { value: 'F', label: 'F' },
]

const SORT_OPTIONS = [
  { value: 'date', label: 'Latest' },
  { value: 'company', label: 'Company A–Z' },
  { value: 'salary', label: 'Salary' },
]

const DATE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: '7days', label: '7 Days' },
  { value: '30days', label: '30 Days' },
]

const WORK_MODE_OPTIONS = [
  { value: null, label: 'All Modes' },
  { value: 'Remote', label: 'Remote', dot: '#10b981', badgeClass: 'badge-remote' },
  { value: 'Hybrid', label: 'Hybrid', dot: '#f59e0b', badgeClass: 'badge-hybrid' },
  { value: 'On-site', label: 'On-site', dot: '#38bdf8', badgeClass: 'badge-onsite' },
]

const PLATFORM_STYLES = {
  LinkedIn: { dot: '#0a66c2', activeBg: 'bg-linkedin/10', activeBorder: 'border-linkedin/30', activeText: 'text-linkedin' },
  Naukri:   { dot: '#16a34a', activeBg: 'bg-naukri/10',   activeBorder: 'border-naukri/30',   activeText: 'text-naukri' },
  Indeed:   { dot: '#d97706', activeBg: 'bg-indeed/10',    activeBorder: 'border-indeed/30',   activeText: 'text-indeed' },
}

export default function JobsBoard() {
  const { jobs, allJobs, loading, filters, setFilters, filterOptions, stats } = useJobs()
  const { profile } = useAuth()
  const { evaluations } = useEvaluations()
  const [selectedJob, setSelectedJob] = useState(null)
  const [gradeFilter, setGradeFilter] = useState(null)
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false)
  const [bookmarks, setBookmarks] = useState(() => {
    const stored = localStorage.getItem('bookmarks')
    return stored ? JSON.parse(stored) : []
  })

  const toggleBookmark = useCallback((job) => {
    setBookmarks(prev => {
      const id = job.id || job.dedup_key
      const next = prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
      localStorage.setItem('bookmarks', JSON.stringify(next))
      return next
    })
  }, [])

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [setFilters])

  const clearAllFilters = useCallback(() => {
    setFilters({ search: '', platform: null, role: null, workMode: null, dateRange: 'all', sort: 'date' })
    setShowBookmarksOnly(false)
  }, [setFilters])

  // Build evaluation lookup map: job_id -> evaluation
  const evalMap = useMemo(() => {
    const map = new Map()
    for (const e of evaluations) {
      if (e.job_id) map.set(e.job_id, e)
    }
    return map
  }, [evaluations])

  // Filter for bookmarks + grade view
  const displayJobs = useMemo(() => {
    let filtered = showBookmarksOnly
      ? jobs.filter(j => bookmarks.includes(j.id || j.dedup_key))
      : jobs
    if (gradeFilter) {
      filtered = filtered.filter(j => {
        const ev = evalMap.get(j.id)
        return ev && ev.grade === gradeFilter
      })
    }
    return filtered
  }, [jobs, showBookmarksOnly, bookmarks, gradeFilter, evalMap])

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.platform) count++
    if (filters.role) count++
    if (filters.workMode) count++
    if (filters.dateRange !== 'all') count++
    if (filters.search) count++
    if (showBookmarksOnly) count++
    return count
  }, [filters, showBookmarksOnly])

  // Platform counts
  const platformCounts = useMemo(() => {
    const c = {}
    allJobs.forEach(j => { c[j.platform] = (c[j.platform] || 0) + 1 })
    return c
  }, [allJobs])

  // Role counts
  const roleCounts = useMemo(() => {
    const c = {}
    allJobs.forEach(j => { c[j.role_type] = (c[j.role_type] || 0) + 1 })
    return c
  }, [allJobs])

  // Work mode counts
  const workModeCounts = useMemo(() => {
    const c = {}
    allJobs.forEach(j => { if (j.work_mode) c[j.work_mode] = (c[j.work_mode] || 0) + 1 })
    return c
  }, [allJobs])

  // Format last updated
  const lastUpdated = useMemo(() => {
    if (!stats.lastUpdated) return null
    const d = new Date(stats.lastUpdated)
    return d.toLocaleString('en-IN', {
      day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
    })
  }, [stats.lastUpdated])

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  return (
    <motion.div
      className="max-w-[1400px] mx-auto px-4 sm:px-6 pb-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* ─── HEADER ─── */}
      <motion.div
        className="flex items-center justify-between py-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="font-display font-bold text-3xl tracking-tight">
            {greeting}, <span className="gradient-text">{firstName}</span>
          </h1>
          <p className="text-dark-muted text-sm font-mono mt-1">
            Showing <span className="text-white font-bold">{displayJobs.length}</span> of {allJobs.length} opportunities
            {activeFilterCount > 0 && (
              <span className="text-accent ml-2">· {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active</span>
            )}
            {lastUpdated && (
              <span className="text-dark-muted/60 ml-3">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot mr-1 align-middle" />
                Last sync: {lastUpdated}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => setShowBookmarksOnly(prev => !prev)}
            className={`px-4 py-2 rounded-xl font-mono text-sm border transition-all ${
              showBookmarksOnly
                ? 'bg-accent/10 text-accent border-accent/30'
                : 'text-dark-muted border-dark-border hover:border-accent/20'
            }`}
            whileTap={{ scale: 0.95 }}
          >
            ♥ Saved ({bookmarks.length})
          </motion.button>
          {activeFilterCount > 0 && (
            <motion.button
              onClick={clearAllFilters}
              className="px-4 py-2 rounded-xl font-mono text-sm text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.95 }}
            >
              ✕ Clear All
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* ─── INLINE STATS ─── */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <MiniStat label="Total Jobs" value={stats.total} accent />
        <MiniStat label="Added Today" value={stats.today} />
        <MiniStat label="LinkedIn" value={stats.linkedin} color="#0a66c2" />
        <MiniStat label="Naukri" value={stats.naukri} color="#16a34a" />
        <MiniStat label="Remote" value={stats.remote} color="#10b981" />
        <MiniStat label="Hybrid" value={stats.hybrid} color="#f59e0b" />
      </motion.div>

      {/* ─── SEARCH BAR ─── */}
      <motion.div
        className="mb-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
      >
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-muted text-base">⌕</span>
          <input
            type="text"
            value={filters.search}
            onChange={e => updateFilter('search', e.target.value)}
            placeholder="Search by title, company, or location..."
            className="premium-input w-full pl-11 pr-4 py-3.5 rounded-2xl text-base"
            id="jobs-search-input"
          />
          {filters.search && (
            <button
              onClick={() => updateFilter('search', '')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-muted hover:text-white transition-colors"
            >✕</button>
          )}
        </div>
      </motion.div>

      {/* ─── CATEGORY FILTER TABS ─── */}
      <motion.div
        className="bg-dark-card border border-dark-border rounded-2xl p-4 mb-5 space-y-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {/* Row 1: Source + Work Mode + Time Range */}
        <div className="flex flex-wrap items-start gap-6">
          {/* Source Category */}
          <FilterCategory label="Source">
            <Chip
              label="All"
              count={allJobs.length}
              active={!filters.platform}
              onClick={() => updateFilter('platform', null)}
            />
            {filterOptions.platforms.map(p => {
              const s = PLATFORM_STYLES[p] || {}
              return (
                <Chip
                  key={p}
                  label={p}
                  count={platformCounts[p] || 0}
                  active={filters.platform === p}
                  onClick={() => updateFilter('platform', filters.platform === p ? null : p)}
                  dotColor={s.dot}
                  activeBg={s.activeBg}
                  activeBorder={s.activeBorder}
                  activeText={s.activeText}
                />
              )
            })}
          </FilterCategory>

          {/* Work Mode */}
          <FilterCategory label="Mode">
            {WORK_MODE_OPTIONS.map(opt => (
              <Chip
                key={opt.label}
                label={opt.label}
                count={opt.value ? (workModeCounts[opt.value] || 0) : undefined}
                active={filters.workMode === opt.value}
                onClick={() => updateFilter('workMode', opt.value)}
                dotColor={opt.dot}
              />
            ))}
          </FilterCategory>

          {/* Time Range */}
          <FilterCategory label="Time">
            {DATE_OPTIONS.map(opt => (
              <Chip
                key={opt.value}
                label={opt.label}
                active={filters.dateRange === opt.value}
                onClick={() => updateFilter('dateRange', opt.value)}
              />
            ))}
          </FilterCategory>

          {/* Sort By */}
          <FilterCategory label="Sort">
            {SORT_OPTIONS.map(opt => (
              <Chip
                key={opt.value}
                label={opt.label}
                active={filters.sort === opt.value}
                onClick={() => updateFilter('sort', opt.value)}
              />
            ))}
          </FilterCategory>
        </div>

        {/* Row 2: Role Categories */}
        <FilterCategory label="Role">
          <Chip
            label="All Roles"
            active={!filters.role}
            onClick={() => updateFilter('role', null)}
          />
          {filterOptions.roles.map(r => (
            <Chip
              key={r}
              label={r}
              count={roleCounts[r] || 0}
              active={filters.role === r}
              onClick={() => updateFilter('role', filters.role === r ? null : r)}
            />
          ))}
        </FilterCategory>

        {/* Grade Filter — only show if evaluations exist */}
        {evaluations.length > 0 && (
          <FilterCategory label="Grade">
            {GRADE_OPTIONS.map(opt => (
              <Chip
                key={opt.label}
                label={opt.label}
                active={gradeFilter === opt.value}
                onClick={() => setGradeFilter(opt.value)}
                dotColor={opt.value ? GRADE_COLORS[opt.value] : undefined}
              />
            ))}
          </FilterCategory>
        )}
      </motion.div>

      {/* ─── DATA TABLE ─── */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="h-16 skeleton rounded-xl" />
          ))}
        </div>
      ) : displayJobs.length === 0 ? (
        <motion.div
          className="text-center py-24 bg-dark-card border border-dark-border rounded-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <span className="text-5xl">🔍</span>
          <h3 className="font-display font-bold text-xl mt-4">No targets found</h3>
          <p className="text-dark-muted text-sm font-mono mt-2">
            {showBookmarksOnly ? 'No saved jobs match your filters' : 'Adjust filters or search query'}
          </p>
          {activeFilterCount > 0 && (
            <motion.button
              onClick={clearAllFilters}
              className="mt-5 px-5 py-2.5 rounded-xl bg-accent/10 text-accent border border-accent/20 font-mono text-sm"
              whileTap={{ scale: 0.95 }}
            >
              Clear all filters
            </motion.button>
          )}
        </motion.div>
      ) : (
        <motion.div
          className="bg-dark-card border border-dark-border rounded-2xl overflow-hidden"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          {/* Table Header */}
          <div className="grid grid-cols-[2fr_1.2fr_0.9fr_0.7fr_0.8fr_0.5fr_0.6fr_0.6fr_0.5fr] gap-3 px-5 py-3 border-b border-dark-border bg-dark-bg/50 text-[11px] font-mono text-dark-muted uppercase tracking-widest">
            <span>Position</span>
            <span>Company</span>
            <span>Location</span>
            <span>Mode</span>
            <span>Salary</span>
            <span>Grade</span>
            <span>Source</span>
            <span>Posted</span>
            <span className="text-center">Action</span>
          </div>

          {/* Table Rows (Virtual) */}
          <div style={{ height: '600px', width: '100%' }}>
            <List
              height={600}
              itemCount={displayJobs.length}
              itemSize={68}
              width="100%"
            >
              {({ index, style }) => {
                const job = displayJobs[index]
                return (
                  <div style={style}>
                    <JobRow
                      job={job}
                      index={index}
                      onClick={setSelectedJob}
                      onBookmark={toggleBookmark}
                      isBookmarked={bookmarks.includes(job.id || job.dedup_key)}
                      evaluation={evalMap.get(job.id)}
                    />
                  </div>
                )
              }}
            </List>
          </div>
        </motion.div>
      )}

      {/* Job Detail Modal */}
      <AnimatePresence>
        {selectedJob && (
          <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ─── Mini Stat Card ────────────────────────────────── */
function MiniStat({ label, value, color, accent }) {
  return (
    <motion.div
      className="stat-card"
      whileHover={{ y: -2 }}
    >
      <AnimatedCounter
        value={value}
        className="font-mono font-bold text-2xl block"
        style={color ? { color } : undefined}
      />
      <span className={`text-[10px] font-mono uppercase tracking-wider mt-1 block ${accent ? 'text-accent' : 'text-dark-muted'}`}>
        {label}
      </span>
    </motion.div>
  )
}

/* ─── Filter Category Label ─────────────────────────── */
function FilterCategory({ label, children }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="font-mono text-[11px] text-dark-muted uppercase tracking-wider font-bold w-14 shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-1.5 flex-wrap">
        {children}
      </div>
    </div>
  )
}

/* ─── Filter Chip ───────────────────────────────────── */
function Chip({ label, active, onClick, count, dotColor, activeBg, activeBorder, activeText }) {
  const activeClasses = activeBg
    ? `${activeBg} ${activeText} ${activeBorder}`
    : 'bg-accent/10 text-accent border-accent/30'
  
  return (
    <motion.button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs border transition-all whitespace-nowrap ${
        active
          ? activeClasses
          : 'text-dark-muted border-dark-border/60 hover:border-accent/20 hover:text-white'
      }`}
      whileTap={{ scale: 0.95 }}
    >
      {dotColor && (
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
      )}
      {label}
      {count !== undefined && (
        <span className={`text-[9px] font-bold ml-0.5 px-1 py-px rounded ${
          active ? 'opacity-80' : 'opacity-50'
        }`}>
          {count}
        </span>
      )}
    </motion.button>
  )
}

/* ─── Work Mode Badge ───────────────────────────────── */
function WorkModeBadge({ mode }) {
  if (!mode) return <span className="text-dark-muted/30 text-[11px] font-mono">—</span>

  const config = {
    'Remote':  { cls: 'badge-remote', icon: '🏠' },
    'Hybrid':  { cls: 'badge-hybrid', icon: '🔄' },
    'On-site': { cls: 'badge-onsite', icon: '🏢' },
  }[mode] || { cls: '', icon: '' }

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border ${config.cls}`}>
      <span className="text-[9px]">{config.icon}</span>
      {mode}
    </span>
  )
}

/* ─── Table Row ─────────────────────────────────────── */
function JobRow({ job, index, onClick, onBookmark, isBookmarked, evaluation }) {
  const platformStyle = PLATFORM_STYLES[job.platform] || {}

  return (
    <motion.div
      className="job-row-card grid-cols-[2fr_1.2fr_0.9fr_0.7fr_0.8fr_0.5fr_0.6fr_0.6fr_0.5fr] group"
      onClick={() => onClick(job)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.5), duration: 0.3 }}
    >
      {/* Position */}
      <div className="min-w-0">
        <p className="text-sm font-medium truncate group-hover:text-accent transition-colors leading-snug">
          {job.title}
        </p>
        <span className="text-[11px] font-mono text-accent/70 mt-0.5 inline-block">
          {job.role_type}
        </span>
      </div>

      {/* Company */}
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
          style={{ backgroundColor: hashColor(job.company || '') }}
        >
          {initials(job.company || '?')}
        </div>
        <span className="text-sm truncate">{job.company}</span>
      </div>

      {/* Location */}
      <span className="text-sm text-dark-muted truncate">
        {job.location || '—'}
      </span>

      {/* Work Mode */}
      <div>
        <WorkModeBadge mode={job.work_mode} />
      </div>

      {/* Salary */}
      <span className={`text-sm truncate ${job.salary ? 'text-emerald-400 font-medium' : 'text-dark-muted/40'}`}>
        {job.salary ? formatSalary(job.salary) : 'Not listed'}
      </span>

      {/* Grade */}
      <div>
        {evaluation ? (
          <span
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg font-mono text-xs font-bold border"
            style={{
              borderColor: (GRADE_COLORS[evaluation.grade] || '#8b8da3') + '40',
              backgroundColor: (GRADE_COLORS[evaluation.grade] || '#8b8da3') + '15',
              color: GRADE_COLORS[evaluation.grade] || '#8b8da3',
            }}
            title={`Score: ${evaluation.overall_score} · ${evaluation.archetype}`}
          >
            {evaluation.grade}
          </span>
        ) : (
          <span className="text-dark-muted/30 text-[11px] font-mono">—</span>
        )}
      </div>

      {/* Source */}
      <div>
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold px-2 py-1 rounded-md border"
          style={{
            borderColor: platformStyle.dot ? `${platformStyle.dot}33` : undefined,
            backgroundColor: platformStyle.dot ? `${platformStyle.dot}15` : undefined,
            color: platformStyle.dot || undefined,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: platformStyle.dot }} />
          {job.platform}
        </span>
      </div>

      {/* Posted */}
      <span className="text-sm text-dark-muted font-mono">
        {formatDate(job.posted_date)}
      </span>

      {/* Actions */}
      <div className="flex items-center justify-center gap-2" onClick={e => e.stopPropagation()}>
        <motion.button
          onClick={() => onBookmark(job)}
          className={`text-base transition-colors ${isBookmarked ? 'text-accent' : 'text-dark-muted/40 hover:text-accent'}`}
          whileTap={{ scale: 1.3 }}
          title={isBookmarked ? 'Unsave' : 'Save'}
        >
          {isBookmarked ? '♥' : '♡'}
        </motion.button>
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-mono font-bold text-accent hover:text-accent-dim transition-colors"
            title="Apply"
          >
            Apply
          </a>
        )}
      </div>
    </motion.div>
  )
}

/* ─── Job Detail Modal ──────────────────────────────── */
function JobDetailModal({ job, onClose }) {
  const platformStyle = PLATFORM_STYLES[job.platform] || {}

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[80]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-4 sm:inset-x-auto sm:top-[6%] sm:bottom-[6%] sm:max-w-3xl sm:mx-auto z-[81] bg-dark-card border border-dark-border rounded-2xl overflow-hidden flex flex-col"
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-dark-border">
          <div>
            <h2 className="font-display font-bold text-xl">{job.title}</h2>
            <p className="text-dark-muted text-base mt-1">{job.company}</p>
            <div className="flex items-center gap-3 mt-2">
              {job.location && <p className="text-dark-muted/60 text-sm">📍 {job.location}</p>}
              <WorkModeBadge mode={job.work_mode} />
            </div>
          </div>
          <motion.button
            onClick={onClose}
            className="text-dark-muted hover:text-white text-xl font-mono p-1"
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
          >
            ✕
          </motion.button>
        </div>

        {/* Info Stat Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4 border-b border-dark-border/50">
          <InfoStat label="Platform" value={job.platform} color={platformStyle.dot} />
          <InfoStat label="Role Type" value={job.role_type} />
          <InfoStat label="Salary" value={job.salary || 'Not listed'} highlight={!!job.salary} />
          <InfoStat label="Posted" value={job.posted_date || '—'} />
        </div>

        {/* Description */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <h3 className="font-mono text-xs text-dark-muted uppercase tracking-wider mb-3 font-bold">
            Job Description
          </h3>
          <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap font-body">
            {job.description || 'No description available. Click "Apply" to view on the original platform.'}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-dark-border">
          {job.url ? (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="premium-btn block w-full text-center py-3.5 rounded-xl text-base"
            >
              Apply Now →
            </a>
          ) : (
            <p className="text-center text-dark-muted text-sm font-mono">No application link</p>
          )}
        </div>
      </motion.div>
    </>
  )
}

/* ─── Info Stat (in modal) ──────────────────────────── */
function InfoStat({ label, value, color, highlight }) {
  return (
    <div className="bg-dark-bg rounded-xl p-3 text-center">
      <p className="text-[10px] font-mono text-dark-muted uppercase tracking-wider mb-1">{label}</p>
      <p
        className={`text-sm font-bold truncate ${highlight ? 'text-emerald-400' : ''}`}
        style={color ? { color } : undefined}
      >
        {value}
      </p>
    </div>
  )
}

// hashColor, initials, formatDate, formatSalary imported from '../utils/format'
