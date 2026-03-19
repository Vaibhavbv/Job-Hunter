import { useState, useEffect, useCallback } from 'react'
import { supabase } from './useSupabase'

const COLUMNS = ['Applied', 'Interview', 'Offer', 'Rejected']

export function useTracker() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchApplications = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('*, jobs(*)')
        .order('updated_at', { ascending: false })

      if (error) {
        // Table might not exist yet — use local state
        console.warn('Applications table not found, using local state:', error.message)
        const stored = localStorage.getItem('applications')
        if (stored) setApplications(JSON.parse(stored))
        setLoading(false)
        return
      }
      setApplications(data || [])
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchApplications()
  }, [fetchApplications])

  // Group applications by status column
  const columns = COLUMNS.reduce((acc, col) => {
    acc[col] = applications.filter(a => a.status === col)
    return acc
  }, {})

  const addApplication = useCallback(async (jobId, status = 'Applied', notes = '') => {
    const newApp = {
      id: crypto.randomUUID(),
      job_id: jobId,
      status,
      notes,
      applied_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Optimistic update
    setApplications(prev => {
      const updated = [newApp, ...prev]
      localStorage.setItem('applications', JSON.stringify(updated))
      return updated
    })

    // Try to upsert to Supabase
    try {
      await supabase.from('applications').upsert(newApp)
    } catch (err) {
      console.warn('Could not save to Supabase:', err)
    }

    return newApp
  }, [])

  const moveApplication = useCallback(async (appId, newStatus) => {
    setApplications(prev => {
      const updated = prev.map(a =>
        a.id === appId
          ? { ...a, status: newStatus, updated_at: new Date().toISOString() }
          : a
      )
      localStorage.setItem('applications', JSON.stringify(updated))
      return updated
    })

    try {
      await supabase
        .from('applications')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', appId)
    } catch (err) {
      console.warn('Could not update in Supabase:', err)
    }
  }, [])

  const removeApplication = useCallback(async (appId) => {
    setApplications(prev => {
      const updated = prev.filter(a => a.id !== appId)
      localStorage.setItem('applications', JSON.stringify(updated))
      return updated
    })

    try {
      await supabase.from('applications').delete().eq('id', appId)
    } catch (err) {
      console.warn('Could not delete from Supabase:', err)
    }
  }, [])

  return {
    applications,
    columns,
    columnNames: COLUMNS,
    loading,
    addApplication,
    moveApplication,
    removeApplication,
    refetch: fetchApplications,
  }
}
