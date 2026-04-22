import { useState, useEffect, useCallback } from 'react'
import { supabase } from './useSupabase'
import { useAuth } from './useAuth'

const COLUMNS = ['Applied', 'Interview', 'Offer', 'Rejected']

export function useTracker() {
  const { user } = useAuth()
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)

  // Load applications from Supabase
  useEffect(() => {
    if (!user) {
      setApplications([])
      setLoading(false)
      return
    }

    async function load() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('application_tracker')
          .select('*')
          .order('updated_at', { ascending: false })

        if (error) throw error
        setApplications(data || [])
      } catch (err) {
        console.error('Failed to load applications:', err)
        setApplications([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user])

  // Add a new application
  const addApplication = useCallback(async ({ title, company, status = 'Applied', notes = '' }) => {
    if (!user) return null
    try {
      const { data, error } = await supabase
        .from('application_tracker')
        .insert({
          user_id: user.id,
          title,
          company,
          status,
          notes,
        })
        .select()
        .single()

      if (error) throw error
      setApplications(prev => [data, ...prev])
      return data
    } catch (err) {
      console.error('Failed to add application:', err)
      return null
    }
  }, [user])

  // Update application status
  const updateStatus = useCallback(async (appId, newStatus) => {
    try {
      const { error } = await supabase
        .from('application_tracker')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', appId)

      if (error) throw error
      setApplications(prev =>
        prev.map(app => app.id === appId ? { ...app, status: newStatus } : app)
      )
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }, [])

  // Delete application
  const deleteApplication = useCallback(async (appId) => {
    try {
      const { error } = await supabase
        .from('application_tracker')
        .delete()
        .eq('id', appId)

      if (error) throw error
      setApplications(prev => prev.filter(app => app.id !== appId))
    } catch (err) {
      console.error('Failed to delete application:', err)
    }
  }, [])

  // Group by status for Kanban view
  const columns = COLUMNS.reduce((acc, status) => {
    acc[status] = applications.filter(app => app.status === status)
    return acc
  }, {})

  return {
    applications,
    columns,
    columnNames: COLUMNS,
    loading,
    addApplication,
    moveApplication: updateStatus,
    removeApplication: deleteApplication,
    COLUMNS,
  }
}
