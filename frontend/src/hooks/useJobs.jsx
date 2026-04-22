import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from './useSupabase'

// Client-side inference for jobs that don't have work_mode set in DB
function inferWorkMode(job) {
  if (job.work_mode) return job.work_mode

  const text = `${job.location || ''} ${job.description || ''} ${job.title || ''}`.toLowerCase()

  if (/\b(remote|work from home|wfh|telecommute|anywhere)\b/.test(text)) return 'Remote'
  if (/\b(hybrid|flex|flexible.?work)\b/.test(text)) return 'Hybrid'
  if (/\b(on[\s-]?site|onsite|in[\s-]?office|office[\s-]?based)\b/.test(text)) return 'On-site'
  return null
}

export function useJobs() {
  const [filters, setFilters] = useState({
    search: '',
    platform: null,
    role: null,
    workMode: null,      // 'Remote' | 'Hybrid' | 'On-site' | null
    dateRange: 'all',    // 'all' | 'today' | '7days' | '30days'
    sort: 'date',        // 'date' | 'salary' | 'company'
  })

  const { data: jobs = [], isLoading: loading, error, refetch: fetchJobs } = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('jobs')
        .select('*')
        .order('posted_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (err) throw err

      return (data || []).map(j => ({
        ...j,
        work_mode: inferWorkMode(j),
      }))
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  })

  // Filtered + sorted jobs
  const filteredJobs = useMemo(() => {
    let result = [...jobs]

    // Search filter
    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(j =>
        (j.title || '').toLowerCase().includes(q) ||
        (j.company || '').toLowerCase().includes(q) ||
        (j.location || '').toLowerCase().includes(q)
      )
    }

    // Platform filter
    if (filters.platform) {
      result = result.filter(j => j.platform === filters.platform)
    }

    // Role filter
    if (filters.role) {
      result = result.filter(j => j.role_type === filters.role)
    }

    // Work mode filter
    if (filters.workMode) {
      result = result.filter(j => j.work_mode === filters.workMode)
    }

    // Date range
    if (filters.dateRange !== 'all') {
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      let cutoff
      if (filters.dateRange === 'today') {
        cutoff = now.toISOString().slice(0, 10)
        result = result.filter(j => j.posted_date === cutoff)
      } else if (filters.dateRange === '7days') {
        const d = new Date(now)
        d.setDate(d.getDate() - 7)
        cutoff = d.toISOString().slice(0, 10)
        result = result.filter(j => j.posted_date >= cutoff)
      } else if (filters.dateRange === '30days') {
        const d = new Date(now)
        d.setDate(d.getDate() - 30)
        cutoff = d.toISOString().slice(0, 10)
        result = result.filter(j => j.posted_date >= cutoff)
      }
    }

    // Sort
    if (filters.sort === 'company') {
      result.sort((a, b) => (a.company || '').localeCompare(b.company || ''))
    } else if (filters.sort === 'salary') {
      result.sort((a, b) => {
        if (a.salary && !b.salary) return -1
        if (!a.salary && b.salary) return 1
        return 0
      })
    }
    // 'date' is already the default sort from the query

    return result
  }, [jobs, filters])

  // Stats computed from all jobs (unfiltered)
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return {
      total: jobs.length,
      today: jobs.filter(j => j.posted_date === today).length,
      linkedin: jobs.filter(j => j.platform === 'LinkedIn').length,
      naukri: jobs.filter(j => j.platform === 'Naukri').length,
      indeed: jobs.filter(j => j.platform === 'Indeed').length,
      remote: jobs.filter(j => j.work_mode === 'Remote').length,
      hybrid: jobs.filter(j => j.work_mode === 'Hybrid').length,
      onsite: jobs.filter(j => j.work_mode === 'On-site').length,
      lastUpdated: jobs.length > 0
        ? jobs.reduce((a, b) => (a.created_at || '') > (b.created_at || '') ? a : b).created_at
        : null,
    }
  }, [jobs])

  // Unique values for filter dropdowns
  const filterOptions = useMemo(() => ({
    platforms: [...new Set(jobs.map(j => j.platform).filter(Boolean))],
    roles: [...new Set(jobs.map(j => j.role_type).filter(Boolean))],
    locations: [...new Set(jobs.map(j => j.location).filter(Boolean))],
    workModes: [...new Set(jobs.map(j => j.work_mode).filter(Boolean))],
  }), [jobs])

  return {
    jobs: filteredJobs,
    allJobs: jobs,
    loading,
    error: error?.message || null,
    stats,
    filters,
    setFilters,
    filterOptions,
    refetch: fetchJobs,
  }
}
