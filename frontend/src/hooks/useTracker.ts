import { useState, useEffect, useCallback } from 'react'
import { supabase } from './useSupabase'
import { useAuth } from './useAuth'
import { useToast } from '../components/Toast'
import type { ApplicationTracker, TrackerStatus } from '../types/database'

const COLUMNS: TrackerStatus[] = ['Applied', 'Interview', 'Offer', 'Rejected']

interface NewApplication {
  title: string
  company: string
  status?: TrackerStatus
  notes?: string
}

export function useTracker() {
  const { user } = useAuth()
  const toast = useToast()
  const [applications, setApplications] = useState<ApplicationTracker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load applications from Supabase
  useEffect(() => {
    if (!user) {
      setApplications([])
      setLoading(false)
      return
    }

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data, error: err } = await supabase
          .from('application_tracker')
          .select('*')
          .order('updated_at', { ascending: false })

        if (err) throw err
        setApplications(data || [])
      } catch (err) {
        console.error('Failed to load applications:', err)
        setError(err instanceof Error ? err.message : 'Failed to load applications')
        setApplications([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user])

  // Add a new application
  const addApplication = useCallback(
    async ({ title, company, status = 'Applied', notes = '' }: NewApplication) => {
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
        setApplications((prev) => [data, ...prev])
        toast.success('Application tracked')
        return data
      } catch (err) {
        console.error('Failed to add application:', err)
        toast.error('Failed to track application — please try again')
        return null
      }
    },
    [user, toast],
  )

  // Update application status
  const updateStatus = useCallback(
    async (appId: string, newStatus: TrackerStatus) => {
      try {
        const { error } = await supabase
          .from('application_tracker')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', appId)

        if (error) throw error
        setApplications((prev) =>
          prev.map((app) => (app.id === appId ? { ...app, status: newStatus } : app)),
        )
      } catch (err) {
        console.error('Failed to update status:', err)
        toast.error('Failed to move application — please try again')
      }
    },
    [toast],
  )

  // Delete application
  const deleteApplication = useCallback(
    async (appId: string) => {
      try {
        const { error } = await supabase.from('application_tracker').delete().eq('id', appId)

        if (error) throw error
        setApplications((prev) => prev.filter((app) => app.id !== appId))
      } catch (err) {
        console.error('Failed to delete application:', err)
        toast.error('Failed to remove application — please try again')
      }
    },
    [toast],
  )

  // Group by status for Kanban view
  const columns = COLUMNS.reduce<Record<TrackerStatus, ApplicationTracker[]>>((acc, status) => {
    acc[status] = applications.filter((app) => app.status === status)
    return acc
  }, {} as Record<TrackerStatus, ApplicationTracker[]>)

  return {
    applications,
    columns,
    columnNames: COLUMNS,
    loading,
    error,
    addApplication,
    moveApplication: updateStatus,
    removeApplication: deleteApplication,
    COLUMNS,
  }
}
