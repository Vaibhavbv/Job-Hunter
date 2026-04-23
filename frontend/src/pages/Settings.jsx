import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTheme } from '../hooks/useTheme'
import { useJobs } from '../hooks/useJobs'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../hooks/useSupabase'
import { useQueryClient } from '@tanstack/react-query'

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
}

export default function Settings() {
  const { theme, toggle } = useTheme()
  const { stats } = useJobs()
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
  const [supabaseStatus] = useState('connected')

  // ─── Profile Form State ───
  const [profileForm, setProfileForm] = useState({
    headline: '',
    bio: '',
    skills: [],
    preferred_roles: [],
    preferred_locations: [],
    min_salary: '',
    experience_years: '',
  })
  const [skillInput, setSkillInput] = useState('')
  const [roleInput, setRoleInput] = useState('')
  const [locationInput, setLocationInput] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  // Sync form with profile from DB
  useEffect(() => {
    if (profile) {
      setProfileForm({
        headline: profile.headline || '',
        bio: profile.bio || '',
        skills: Array.isArray(profile.skills) ? profile.skills : [],
        preferred_roles: Array.isArray(profile.preferred_roles) ? profile.preferred_roles : [],
        preferred_locations: Array.isArray(profile.preferred_locations) ? profile.preferred_locations : [],
        min_salary: profile.min_salary || '',
        experience_years: profile.experience_years || '',
      })
    }
  }, [profile])

  // ─── Scraping Filters State ───
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

  // ─── Profile Handlers ───
  const updateField = useCallback((field, value) => {
    setProfileForm(prev => ({ ...prev, [field]: value }))
  }, [])

  const addTag = useCallback((field, inputState, setInputState) => {
    const trimmed = inputState.trim()
    if (!trimmed) return
    setProfileForm(prev => {
      if (prev[field].includes(trimmed)) return prev
      return { ...prev, [field]: [...prev[field], trimmed] }
    })
    setInputState('')
  }, [])

  const removeTag = useCallback((field, value) => {
    setProfileForm(prev => ({
      ...prev,
      [field]: prev[field].filter(v => v !== value),
    }))
  }, [])

  const handleSaveProfile = async () => {
    if (!user) return
    setSavingProfile(true)
    setSaveMessage('')

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          headline: profileForm.headline || null,
          bio: profileForm.bio || null,
          skills: profileForm.skills,
          preferred_roles: profileForm.preferred_roles,
          preferred_locations: profileForm.preferred_locations,
          min_salary: profileForm.min_salary ? Number(profileForm.min_salary) : null,
          experience_years: profileForm.experience_years ? Number(profileForm.experience_years) : null,
        })
        .eq('id', user.id)

      if (error) throw error

      // Invalidate profile cache so useAuth re-fetches
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      setSaveMessage('Profile saved successfully!')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (err) {
      console.error('Failed to save profile:', err)
      setSaveMessage('Failed to save profile. Please try again.')
    } finally {
      setSavingProfile(false)
    }
  }

  // ─── Filter Handlers ───
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
          Profile, preferences, and connection status
        </p>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════
         PROFILE CONFIGURATION (Phase 7)
         ═══════════════════════════════════════════════════════════ */}
      <motion.div variants={item} className="bg-dark-card border border-dark-border rounded-2xl p-5 mb-4">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-mono text-xs text-dark-muted uppercase tracking-wider">
            Candidate Profile
          </h3>
          {profile?.base_resume && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent/10 text-accent">
              Resume Linked ✓
            </span>
          )}
        </div>

        <div className="space-y-5">
          {/* Headline */}
          <div>
            <label className="text-xs font-mono text-dark-muted block mb-1.5">Headline</label>
            <input
              type="text"
              value={profileForm.headline}
              onChange={e => updateField('headline', e.target.value)}
              placeholder="e.g. Senior Data Engineer | Python & Spark"
              className="premium-input w-full rounded-xl text-sm"
              id="profile-headline"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="text-xs font-mono text-dark-muted block mb-1.5">Bio / Summary</label>
            <textarea
              value={profileForm.bio}
              onChange={e => updateField('bio', e.target.value)}
              placeholder="Brief professional summary..."
              className="premium-input w-full rounded-xl text-sm h-20 resize-none"
              id="profile-bio"
            />
          </div>

          {/* Experience + Salary Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono text-dark-muted block mb-1.5">Years of Experience</label>
              <input
                type="number"
                value={profileForm.experience_years}
                onChange={e => updateField('experience_years', e.target.value)}
                placeholder="e.g. 5"
                className="premium-input w-full rounded-xl text-sm"
                min="0"
                max="50"
                id="profile-experience"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-dark-muted block mb-1.5">Min Salary (yearly)</label>
              <input
                type="number"
                value={profileForm.min_salary}
                onChange={e => updateField('min_salary', e.target.value)}
                placeholder="e.g. 1200000"
                className="premium-input w-full rounded-xl text-sm"
                id="profile-salary"
              />
            </div>
          </div>

          {/* Skills Tag Input */}
          <div>
            <label className="text-xs font-mono text-dark-muted block mb-1.5">
              Skills ({profileForm.skills.length})
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); addTag('skills', skillInput, setSkillInput) }
                }}
                placeholder="Add a skill and press Enter"
                className="premium-input flex-1 rounded-xl text-sm"
                id="profile-skills-input"
              />
              <button
                onClick={() => addTag('skills', skillInput, setSkillInput)}
                className="premium-btn px-3 py-2 rounded-xl text-sm"
                type="button"
              >
                +
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {profileForm.skills.map(skill => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/5 text-accent border border-accent/10 font-mono text-xs"
                >
                  {skill}
                  <button
                    onClick={() => removeTag('skills', skill)}
                    className="text-accent/60 hover:text-accent ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Preferred Roles Tag Input */}
          <div>
            <label className="text-xs font-mono text-dark-muted block mb-1.5">
              Target Roles ({profileForm.preferred_roles.length})
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={roleInput}
                onChange={e => setRoleInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); addTag('preferred_roles', roleInput, setRoleInput) }
                }}
                placeholder="e.g. Data Engineer, ML Engineer"
                className="premium-input flex-1 rounded-xl text-sm"
                id="profile-roles-input"
              />
              <button
                onClick={() => addTag('preferred_roles', roleInput, setRoleInput)}
                className="premium-btn px-3 py-2 rounded-xl text-sm"
                type="button"
              >
                +
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {profileForm.preferred_roles.map(role => (
                <span
                  key={role}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/5 text-blue-400 border border-blue-500/10 font-mono text-xs"
                >
                  {role}
                  <button
                    onClick={() => removeTag('preferred_roles', role)}
                    className="text-blue-400/60 hover:text-blue-400 ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Preferred Locations Tag Input */}
          <div>
            <label className="text-xs font-mono text-dark-muted block mb-1.5">
              Preferred Locations ({profileForm.preferred_locations.length})
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={locationInput}
                onChange={e => setLocationInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); addTag('preferred_locations', locationInput, setLocationInput) }
                }}
                placeholder="e.g. Bangalore, Remote, Mumbai"
                className="premium-input flex-1 rounded-xl text-sm"
                id="profile-locations-input"
              />
              <button
                onClick={() => addTag('preferred_locations', locationInput, setLocationInput)}
                className="premium-btn px-3 py-2 rounded-xl text-sm"
                type="button"
              >
                +
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {profileForm.preferred_locations.map(loc => (
                <span
                  key={loc}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/5 text-purple-400 border border-purple-500/10 font-mono text-xs"
                >
                  📍 {loc}
                  <button
                    onClick={() => removeTag('preferred_locations', loc)}
                    className="text-purple-400/60 hover:text-purple-400 ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Resume Status */}
          <div className="bg-dark-bg rounded-xl p-4 border border-dark-border/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-dark-muted">Base Resume</p>
                {profile?.base_resume ? (
                  <p className="text-sm text-accent mt-1">
                    ✓ {profile.base_resume.length.toLocaleString()} characters uploaded
                  </p>
                ) : (
                  <p className="text-sm text-amber-400 mt-1">
                    ⚠ No resume linked — upload one via AI Dashboard
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Save Profile */}
          <div className="flex items-center gap-3">
            <motion.button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="premium-btn px-6 py-2.5 rounded-xl text-sm disabled:opacity-50"
              whileTap={{ scale: 0.95 }}
            >
              {savingProfile ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-dark-bg/30 border-t-dark-bg rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                'Save Profile'
              )}
            </motion.button>
            <AnimatePresence>
              {saveMessage && (
                <motion.span
                  className={`text-xs font-mono ${saveMessage.includes('success') ? 'text-accent' : 'text-red-400'}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                >
                  {saveMessage}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════
         SCRAPING PREFERENCES
         ═══════════════════════════════════════════════════════════ */}
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
           <p>Job Hunter v3.0 — AI-Powered SaaS Platform</p>
           <p>Built with React + Vite + Tailwind + Framer Motion + Gemini AI</p>
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
