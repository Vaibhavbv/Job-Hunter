import { useMemo } from 'react'
import { motion } from 'motion/react'
import { useJobs } from '../hooks/useJobs'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
}

const chartTooltipStyle = {
  background: '#12121a',
  border: '1px solid #1e1e2e',
  borderRadius: '12px',
  fontSize: '11px',
  fontFamily: 'JetBrains Mono',
}

export default function Analytics() {
  const { allJobs, loading } = useJobs()

  // Jobs over time (by posted_date)
  const timelineData = useMemo(() => {
    const byDate = {}
    allJobs.forEach(j => {
      const d = j.posted_date || 'unknown'
      byDate[d] = (byDate[d] || 0) + 1
    })
    return Object.entries(byDate)
      .filter(([d]) => d !== 'unknown')
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30) // Last 30 days
      .map(([date, count]) => ({ date: date.slice(5), count })) // MM-DD format
  }, [allJobs])

  // Top companies
  const topCompanies = useMemo(() => {
    const counts = {}
    allJobs.forEach(j => {
      const c = j.company || 'Unknown'
      counts[c] = (counts[c] || 0) + 1
    })
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, count]) => ({ name: name.length > 15 ? name.slice(0, 15) + '…' : name, count }))
  }, [allJobs])

  // Top roles
  const topRoles = useMemo(() => {
    const counts = {}
    allJobs.forEach(j => {
      const r = j.role_type || 'Unknown'
      counts[r] = (counts[r] || 0) + 1
    })
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }))
  }, [allJobs])

  // Activity heatmap (like GitHub contribution grid)
  const heatmapData = useMemo(() => {
    const byDate = {}
    allJobs.forEach(j => {
      const d = j.posted_date
      if (d) byDate[d] = (byDate[d] || 0) + 1
    })

    // Generate last 90 days
    const days = []
    for (let i = 89; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const str = d.toISOString().slice(0, 10)
      days.push({ date: str, count: byDate[str] || 0, day: d.getDay() })
    }
    return days
  }, [allJobs])

  const maxHeatmap = useMemo(() => Math.max(...heatmapData.map(d => d.count), 1), [heatmapData])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="space-y-6">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-64 skeleton rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className="max-w-7xl mx-auto px-4 sm:px-6 pb-12"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.1 } } }}
    >
      {/* Header */}
      <motion.div variants={item} className="py-6">
        <h1 className="font-display font-bold text-2xl tracking-tight">
          Analytics <span className="text-accent">Console</span>
        </h1>
        <p className="text-dark-muted text-xs font-mono mt-1">
          {allJobs.length} data points · 90-day window
        </p>
      </motion.div>

      {/* Activity Heatmap */}
      <motion.div
        variants={item}
        className="bg-dark-card border border-dark-border rounded-2xl p-5 mb-6"
      >
        <h3 className="font-mono text-xs text-dark-muted uppercase tracking-wider mb-4">
          Scraping Activity · Last 90 Days
        </h3>
        <div className="flex flex-wrap gap-[3px]">
          {heatmapData.map((d, i) => {
            const intensity = d.count / maxHeatmap
            return (
              <motion.div
                key={d.date}
                className="w-3 h-3 rounded-sm"
                style={{
                  backgroundColor: d.count === 0
                    ? '#1e1e2e'
                    : `rgba(0, 255, 136, ${0.15 + intensity * 0.85})`,
                }}
                title={`${d.date}: ${d.count} jobs`}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.005 }}
              />
            )
          })}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-1 mt-3 text-[9px] font-mono text-dark-muted">
          <span>Less</span>
          {[0, 0.25, 0.5, 0.75, 1].map(v => (
            <div
              key={v}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: v === 0 ? '#1e1e2e' : `rgba(0, 255, 136, ${0.15 + v * 0.85})` }}
            />
          ))}
          <span>More</span>
        </div>
      </motion.div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Jobs Over Time */}
        <motion.div
          variants={item}
          className="bg-dark-card border border-dark-border rounded-2xl p-5"
        >
          <h3 className="font-mono text-xs text-dark-muted uppercase tracking-wider mb-4">
            Jobs Scraped Over Time
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8b8da3' }} />
                <YAxis tick={{ fontSize: 10, fill: '#8b8da3' }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#00ff88"
                  strokeWidth={2}
                  dot={{ fill: '#00ff88', r: 3 }}
                  animationDuration={1200}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Top Companies */}
        <motion.div
          variants={item}
          className="bg-dark-card border border-dark-border rounded-2xl p-5"
        >
          <h3 className="font-mono text-xs text-dark-muted uppercase tracking-wider mb-4">
            Top Companies
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCompanies} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10, fill: '#8b8da3' }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#8b8da3' }} width={120} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="count" fill="#4fc3f7" radius={[0, 6, 6, 0]} animationDuration={1000} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Top Roles */}
      <motion.div
        variants={item}
        className="bg-dark-card border border-dark-border rounded-2xl p-5"
      >
        <h3 className="font-mono text-xs text-dark-muted uppercase tracking-wider mb-4">
          Top Roles
        </h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topRoles}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8b8da3', angle: -20 }} />
              <YAxis tick={{ fontSize: 10, fill: '#8b8da3' }} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="count" fill="#00ff88" radius={[6, 6, 0, 0]} animationDuration={1000} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </motion.div>
  )
}
