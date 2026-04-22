import { useMemo } from 'react'
import { motion } from 'motion/react'
import { useJobs } from '../hooks/useJobs'
import AnimatedCounter from '../components/AnimatedCounter'
import JobCard from '../components/JobCard'
import { SkeletonGrid, SkeletonStat } from '../components/SkeletonLoader'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { hashColor, initials } from '../utils/format'

// Stagger container + child variants for the page
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
}

const PLATFORM_COLORS = {
  LinkedIn: '#0a66c2',
  Naukri:   '#16a34a',
  Indeed:   '#d97706',
}

export default function Dashboard() {
  const { jobs, allJobs, loading, stats } = useJobs()

  // Donut chart data
  const pieData = useMemo(() => [
    { name: 'LinkedIn', value: stats.linkedin, color: PLATFORM_COLORS.LinkedIn },
    { name: 'Naukri', value: stats.naukri, color: PLATFORM_COLORS.Naukri },
    { name: 'Indeed', value: stats.indeed, color: PLATFORM_COLORS.Indeed },
  ].filter(d => d.value > 0), [stats])

  // Recent jobs (first 12)
  const recentJobs = useMemo(() => allJobs.slice(0, 12), [allJobs])

  // Format last updated
  const lastUpdated = useMemo(() => {
    if (!stats.lastUpdated) return null
    const d = new Date(stats.lastUpdated)
    return d.toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }, [stats.lastUpdated])

  return (
    <motion.div
      className="max-w-7xl mx-auto px-4 sm:px-6 pb-12"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between py-6">
        <div>
          <h1 className="font-display font-bold text-2xl tracking-tight">
            Command <span className="text-accent">Center</span>
          </h1>
          <p className="text-dark-muted text-xs font-mono mt-1">
            Intelligence overview · Real-time job market data
          </p>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-2 text-xs font-mono text-dark-muted">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse-dot" />
            Last sync: {lastUpdated}
          </div>
        )}
      </motion.div>

      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {Array.from({ length: 5 }, (_, i) => <SkeletonStat key={i} />)}
        </div>
      ) : (
        <motion.div variants={item} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <StatCard label="Total Scraped" value={stats.total} accent />
          <StatCard label="Added Today" value={stats.today} />
          <StatCard label="LinkedIn" value={stats.linkedin} color="#0a66c2" />
          <StatCard label="Naukri" value={stats.naukri} color="#16a34a" />
          <StatCard label="Indeed" value={stats.indeed} color="#d97706" />
        </motion.div>
      )}

      {/* Middle Row: Donut Chart + Latest Activity */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {/* Donut Chart */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 lg:col-span-1">
          <h3 className="font-mono text-xs text-dark-muted uppercase tracking-wider mb-4">
            Source Breakdown
          </h3>
          {pieData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    animationBegin={300}
                    animationDuration={800}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#12121a',
                      border: '1px solid #1e1e2e',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontFamily: 'JetBrains Mono',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-dark-muted text-sm">
              No data yet
            </div>
          )}
          {/* Legend */}
          <div className="flex justify-center gap-4 mt-2">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-[10px] font-mono text-dark-muted">{d.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Jobs Feed */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5 lg:col-span-2">
          <h3 className="font-mono text-xs text-dark-muted uppercase tracking-wider mb-4">
            Latest Intercepts
          </h3>
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {loading ? (
              Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="h-14 skeleton rounded-xl" />
              ))
            ) : recentJobs.length === 0 ? (
              <p className="text-dark-muted text-sm text-center py-8">No jobs yet</p>
            ) : (
              recentJobs.map((job, i) => (
                <motion.a
                  key={job.id || i}
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-dark-hover transition-colors group"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                    style={{ backgroundColor: hashColor(job.company || '') }}
                  >
                    {initials(job.company || '?')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate group-hover:text-accent transition-colors">
                      {job.title}
                    </p>
                    <p className="text-[10px] text-dark-muted truncate">
                      {job.company} · {job.platform}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-dark-muted shrink-0">
                    {job.posted_date || '—'}
                  </span>
                </motion.a>
              ))
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ─── Stat Card ─────────────────────────────────────── */
function StatCard({ label, value, color, accent }) {
  return (
    <motion.div
      className="bg-dark-card border border-dark-border rounded-2xl p-5 text-center group hover:border-accent/20 transition-colors"
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

// hashColor, initials imported from '../utils/format'
