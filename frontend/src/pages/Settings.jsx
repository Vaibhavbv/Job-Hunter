import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { useTheme } from '../hooks/useTheme'
import { useJobs } from '../hooks/useJobs'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../hooks/useSupabase'

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
}

export default function Settings() {
  const { theme, toggle } = useTheme()
  const { stats } = useJobs()
  const { user } = useAuth()
  const [supabaseStatus] = useState('connected')

  // User Filters State
  const [filters, setFilters] = useState([])
  const [newRole, setNewRole] = useState('')
  const [newLocation, setNewLocation] = useState('Remote')
  const [loadingFilters, setLoadingFilters] = useState(true)

  useEffect(() => {
    if (user) {
      supabase.from('user_filters')
        .select('*')
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          setFilters(data || [])
          setLoadingFilters(false)
        })
    }
  }, [user])

  const handleAddFilter = async (e) => {
    e.preventDefault()
    if (!newRole.trim()) return
    try {
      const { data, error } = await supabase.from('user_filters').insert([{
        user_id: user.id,
        role_type: newRole.trim(),
        location: newLocation.trim(),
        platform_preference: 'All',
        is_active: true
      }]).select()
      
      if (error) throw error
      if (data) setFilters([data[0], ...filters])
      
      setNewRole('')
      setNewLocation('Remote')
    } catch (err) {
      console.error('Failed to add filter:', err)
      alert("Failed to add filter")
    }
  }

  const toggleFilterActive = async (filterId, currentState) => {
    try {
      setFilters(filters.map(f => f.id === filterId ? { ...f, is_active: !currentState } : f))
      await supabase.from('user_filters')
        .update({ is_active: !currentState })
        .eq('id', filterId)
    } catch (err) {
      console.error(err)
    }
  }

  const deleteFilter = async (filterId) => {
    try {
      setFilters(filters.filter(f => f.id !== filterId))
      await supabase.from('user_filters').delete().eq('id', filterId)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <motion.div
      className="max-w-3xl mx-auto px-4 sm:px-6 pb-12"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.1 } } }}
    >
      {/* Header */}
      <motion.div variants={item} className="py-6">
        <h1 className="font-display font-bold text-2xl tracking-tight">
          System <span className="text-accent">Config</span>
        </h1>
        <p className="text-dark-muted text-xs font-mono mt-1">
          Terminal preferences and connection status
        </p>
      </motion.div>

      {/* Scraping Preferences */}
      <motion.div variants={item} className="bg-dark-card border border-dark-border rounded-2xl p-5 mb-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-mono text-xs text-dark-muted uppercase tracking-wider">
            Scraping Preferences
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent/10 text-accent">Active Webhook</span>
        </div>
        
        <form onSubmit={handleAddFilter} className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Role (e.g. Data Engineer)"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="premium-input flex-1 px-3 py-2 rounded-xl text-sm"
          />
          <input
            type="text"
            placeholder="Location"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            className="premium-input w-32 px-3 py-2 rounded-xl text-sm"
          />
          <button type="submit" className="premium-btn px-4 py-2 rounded-xl text-sm">
            Add
          </button>
        </form>

        <div className="space-y-2">
          {loadingFilters ? (
            <div className="text-xs text-dark-muted font-mono animate-pulse">Loading filters...</div>
          ) : filters.length === 0 ? (
            <div className="text-xs text-dark-muted font-mono">No scraping filters defined.</div>
          ) : (
            filters.map(filter => (
              <div key={filter.id} className="flex items-center justify-between bg-dark-bg p-3 rounded-xl border border-dark-border">
                <div>
                  <p className={`text-sm font-medium ${filter.is_active ? 'text-white' : 'text-dark-muted line-through'}`}>
                    {filter.role_type}
                  </p>
                  <p className="text-[10px] text-dark-muted mt-0.5 font-mono">
                    📍 {filter.location} · Platforms: {filter.platform_preference}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleFilterActive(filter.id, filter.is_active)} className="text-xs text-dark-muted hover:text-white">
                    {filter.is_active ? 'Pause' : 'Resume'}
                  </button>
                  <button onClick={() => deleteFilter(filter.id)} className="text-xs text-red-400 hover:text-red-300">
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>

      {/* Appearance */}
      <motion.div variants={item} className="bg-dark-card border border-dark-border rounded-2xl p-5 mb-4">
        <h3 className="font-mono text-xs text-dark-muted uppercase tracking-wider mb-4">
          Appearance
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Theme Mode</p>
            <p className="text-[10px] text-dark-muted font-mono mt-0.5">
              Current: {theme === 'dark' ? 'Dark Ops' : 'Light Mode'}
            </p>
          </div>
          <motion.button
             onClick={toggle}
             className={`w-14 h-7 rounded-full p-1 transition-colors ${
               theme === 'dark' ? 'bg-accent/20' : 'bg-gray-300'
             }`}
             whileTap={{ scale: 0.95 }}
           >
             <motion.div
               className={`w-5 h-5 rounded-full ${
                 theme === 'dark' ? 'bg-accent' : 'bg-white'
               }`}
               animate={{ x: theme === 'dark' ? 24 : 0 }}
               transition={{ type: 'spring', stiffness: 500, damping: 30 }}
             />
           </motion.button>
        </div>
      </motion.div>

      {/* Supabase Connection */}
      <motion.div variants={item} className="bg-dark-card border border-dark-border rounded-2xl p-5 mb-4">
        <h3 className="font-mono text-xs text-dark-muted uppercase tracking-wider mb-4">
          Database Connection
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                supabaseStatus === 'connected' ? 'bg-accent animate-pulse-dot' : 'bg-red-400'
              }`} />
              <span className="text-sm">Supabase</span>
            </div>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
              supabaseStatus === 'connected'
                ? 'bg-accent/10 text-accent'
                : 'bg-red-500/10 text-red-400'
            }`}>
              {supabaseStatus === 'connected' ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>
          <div className="text-[10px] font-mono text-dark-muted space-y-1">
            <p>Endpoint: {import.meta.env.VITE_SUPABASE_URL?.replace('https://', '') || 'configured'}</p>
            <p>Total records: {stats.total}</p>
          </div>
        </div>
      </motion.div>

      {/* Scraper Info */}
      <motion.div variants={item} className="bg-dark-card border border-dark-border rounded-2xl p-5 mb-4">
        <h3 className="font-mono text-xs text-dark-muted uppercase tracking-wider mb-4">
          Scraper Status
        </h3>
        <div className="space-y-3">
          <InfoRow label="Schedule" value="Daily at 08:00 IST" />
          <InfoRow label="Platforms" value="LinkedIn · Naukri · Indeed" />
          <InfoRow label="Last sync" value={stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'N/A'} />
          <InfoRow label="Total scraped" value={`${stats.total} jobs`} />
        </div>
        <a
          href="https://github.com/Vaibhavbv/Job-Hunter/actions"
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-4"
        >
          <motion.button
            className="w-full py-2.5 rounded-xl bg-cold-blue/10 text-cold-blue border border-cold-blue/20 font-mono text-xs font-bold hover:bg-cold-blue/20 transition-colors"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            Trigger Manual Run →
          </motion.button>
        </a>
      </motion.div>

      {/* About */}
      <motion.div variants={item} className="bg-dark-card border border-dark-border rounded-2xl p-5">
        <h3 className="font-mono text-xs text-dark-muted uppercase tracking-wider mb-4">
          About
        </h3>
        <div className="space-y-2 text-[11px] font-mono text-dark-muted">
           <p>Job Hunter v2.0 — Dark Ops Intelligence Terminal</p>
           <p>Built with React + Vite + Tailwind + Framer Motion</p>
           <p className="flex items-center gap-2">
             <a href="https://github.com/Vaibhavbv/Job-Hunter" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
               GitHub Repository
             </a>
           </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-mono text-dark-muted">{label}</span>
      <span className="text-[11px] font-mono text-white">{value}</span>
    </div>
  )
}
