import { useMemo } from 'react'
import { motion } from 'motion/react'
import { useJobs } from '../hooks/useJobs'
import { useEvaluations } from '../hooks/useEvaluations'
import AnimatedCounter from '../components/AnimatedCounter'
import { SkeletonGrid, SkeletonStat } from '../components/SkeletonLoader'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, Radar, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { hashColor, initials } from '../utils/format'

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

const GRADE_COLORS = {
  'A+': '#00ff88',
  'A':  '#34d399',
  'B+': '#60a5fa',
  'B':  '#818cf8',
  'C':  '#fbbf24',
  'D':  '#f97316',
  'F':  '#ef4444',
}

const ARCHETYPE_COLORS = {
  'Dream Job':    '#00ff88',
  'Strong Match': '#34d399',
  'Worth Trying': '#60a5fa',
  'Stretch':      '#fbbf24',
  'Mismatch':     '#ef4444',
  'Dealbreaker':  '#6b7280',
}

const chartTooltipStyle = {
  background: '#12121a',
  border: '1px solid #1e1e2e',
  borderRadius: '12px',
  fontSize: '11px',
  fontFamily: 'JetBrains Mono',
}

export default function Dashboard() {
  const { allJobs, loading: jobsLoading, stats: jobStats } = useJobs()
  const { evaluations, loading: evalsLoading, stats: evalStats } = useEvaluations()

  const loading = jobsLoading || evalsLoading

  // Donut chart data — platform mix
  const platformPieData = useMemo(() => [
    { name: 'LinkedIn', value: jobStats.linkedin, color: PLATFORM_COLORS.LinkedIn },
    { name: 'Naukri', value: jobStats.naukri, color: PLATFORM_COLORS.Naukri },
    { name: 'Indeed', value: jobStats.indeed, color: PLATFORM_COLORS.Indeed },
  ].filter(d => d.value > 0), [jobStats])

  // Grade distribution for bar chart
  const gradeChartData = useMemo(() => {
    const order = ['A+', 'A', 'B+', 'B', 'C', 'D', 'F']
    return order.map(grade => ({
      grade,
      count: evalStats.gradeDistribution[grade] || 0,
      fill: GRADE_COLORS[grade],
    }))
  }, [evalStats.gradeDistribution])

  // Archetype donut
  const archetypePieData = useMemo(() => {
    return Object.entries(evalStats.archetypeDistribution)
      .filter(([, count]) => count > 0)
      .map(([name, value]) => ({ name, value, color: ARCHETYPE_COLORS[name] || '#6b7280' }))
  }, [evalStats.archetypeDistribution])

  // Average dimension scores for radar chart
  const dimensionRadar = useMemo(() => {
    if (evaluations.length === 0) return []
    const dims = ['technical_fit', 'seniority_fit', 'domain_fit', 'salary_fit', 'location_fit']
    const labels = ['Technical', 'Seniority', 'Domain', 'Salary', 'Location']
    return dims.map((d, i) => {
      const scores = evaluations.map(e => e[d]).filter(Boolean)
      const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
      return { dimension: labels[i], score: avg }
    })
  }, [evaluations])

  // Top 5 evaluated jobs
  const topJobs = useMemo(() => evalStats.topJobs || [], [evalStats.topJobs])

  // Format last updated
  const lastUpdated = useMemo(() => {
    if (!jobStats.lastUpdated) return null
    const d = new Date(jobStats.lastUpdated)
    return d.toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }, [jobStats.lastUpdated])

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

      {/* ─── STAT CARDS ─── */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {Array.from({ length: 6 }, (_, i) => <SkeletonStat key={i} />)}
        </div>
      ) : (
        <motion.div variants={item} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          <StatCard label="Jobs Scraped" value={jobStats.total} accent />
          <StatCard label="Evaluated" value={evalStats.total} color="#818cf8" />
          <StatCard label="Avg Score" value={evalStats.avgScore} color={evalStats.avgScore >= 60 ? '#00ff88' : evalStats.avgScore >= 40 ? '#fbbf24' : '#ef4444'} />
          <StatCard label="Apply Now" value={(evalStats.archetypeDistribution?.['Dream Job'] || 0) + (evalStats.archetypeDistribution?.['Strong Match'] || 0)} color="#00ff88" />
          <StatCard label="Gate Fails" value={evalStats.gateFailCount} color="#ef4444" />
          <StatCard label="Added Today" value={jobStats.today} />
        </motion.div>
      )}

      {/* ─── MIDDLE ROW: Charts ─── */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Grade Distribution */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5">
          <h3 className="font-mono text-xs text-dark-muted uppercase tracking-wider mb-4">
            Grade Distribution
          </h3>
          {gradeChartData.some(d => d.count > 0) ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gradeChartData}>
                  <XAxis dataKey="grade" tick={{ fontSize: 11, fill: '#8b8da3', fontFamily: 'JetBrains Mono' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#8b8da3' }} allowDecimals={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} animationDuration={800}>
                    {gradeChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="No evaluations yet" />
          )}
        </div>

        {/* Dimension Radar */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5">
          <h3 className="font-mono text-xs text-dark-muted uppercase tracking-wider mb-4">
            Average Fit Dimensions
          </h3>
          {dimensionRadar.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={dimensionRadar}>
                  <PolarGrid stroke="#1e1e2e" />
                  <PolarAngleAxis
                    dataKey="dimension"
                    tick={{ fontSize: 10, fill: '#8b8da3', fontFamily: 'JetBrains Mono' }}
                  />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="#00ff88"
                    fill="#00ff88"
                    fillOpacity={0.15}
                    strokeWidth={2}
                    animationDuration={1000}
                  />
                  <Tooltip contentStyle={chartTooltipStyle} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="Upload resume & evaluate" />
          )}
        </div>

        {/* Source Breakdown + Archetype */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5">
          <h3 className="font-mono text-xs text-dark-muted uppercase tracking-wider mb-4">
            {archetypePieData.length > 0 ? 'Job Archetypes' : 'Source Breakdown'}
          </h3>
          {(archetypePieData.length > 0 ? archetypePieData : platformPieData).length > 0 ? (
            <>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={archetypePieData.length > 0 ? archetypePieData : platformPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                      animationBegin={300}
                      animationDuration={800}
                    >
                      {(archetypePieData.length > 0 ? archetypePieData : platformPieData).map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {(archetypePieData.length > 0 ? archetypePieData : platformPieData).map(d => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-[10px] font-mono text-dark-muted">{d.name}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyChart message="No data yet" />
          )}
        </div>
      </motion.div>

      {/* ─── TOP MATCHES + RECENT JOBS ─── */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Top Evaluated Jobs */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5">
          <h3 className="font-mono text-xs text-dark-muted uppercase tracking-wider mb-4">
            🏆 Top Matches
          </h3>
          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {topJobs.length === 0 ? (
              <p className="text-dark-muted text-sm text-center py-8 font-mono">
                No evaluations yet — evaluate jobs to see your top matches
              </p>
            ) : (
              topJobs.map((evaluation, i) => {
                const job = evaluation.jobs
                if (!job) return null
                return (
                  <motion.a
                    key={evaluation.id}
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-dark-hover transition-colors group"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    {/* Rank */}
                    <span className="text-accent font-mono font-bold text-sm w-5 shrink-0">
                      #{i + 1}
                    </span>

                    {/* Company avatar */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: hashColor(job.company || '') }}
                    >
                      {initials(job.company || '?')}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate group-hover:text-accent transition-colors">
                        {job.title}
                      </p>
                      <p className="text-[10px] text-dark-muted truncate">
                        {job.company} · {job.platform}
                      </p>
                    </div>

                    {/* Score + Grade */}
                    <div className="text-right shrink-0">
                      <span
                        className="font-mono font-bold text-sm"
                        style={{ color: GRADE_COLORS[evaluation.grade] }}
                      >
                        {evaluation.overall_score}
                      </span>
                      <p
                        className="text-[9px] font-mono font-bold uppercase"
                        style={{ color: GRADE_COLORS[evaluation.grade] }}
                      >
                        {evaluation.grade}
                      </p>
                    </div>
                  </motion.a>
                )
              })
            )}
          </div>
        </div>

        {/* Latest Scraped Jobs */}
        <div className="bg-dark-card border border-dark-border rounded-2xl p-5">
          <h3 className="font-mono text-xs text-dark-muted uppercase tracking-wider mb-4">
            Latest Intercepts
          </h3>
          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {loading ? (
              Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="h-14 skeleton rounded-xl" />
              ))
            ) : allJobs.length === 0 ? (
              <p className="text-dark-muted text-sm text-center py-8">No jobs yet</p>
            ) : (
              allJobs.slice(0, 10).map((job, i) => (
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

/* ─── Stat Card ─── */
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

/* ─── Empty Chart Placeholder ─── */
function EmptyChart({ message }) {
  return (
    <div className="h-48 flex items-center justify-center text-dark-muted text-sm font-mono">
      {message}
    </div>
  )
}
