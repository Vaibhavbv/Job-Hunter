import { useState, useEffect, useCallback } from 'react'
import { supabase } from './useSupabase'
import * as api from '../services/api'

const SESSION_KEY = 'jh_session_id'

export function useSession() {
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(SESSION_KEY))
  const [resumeText, setResumeText] = useState('')
  const [jobTitles, setJobTitles] = useState([])
  const [aiJobs, setAiJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('') // 'parsing' | 'fetching' | 'scoring' | 'rewriting' | ''
  const [error, setError] = useState(null)

  // Load session data from Supabase if we have a session ID
  useEffect(() => {
    if (!sessionId) return
    
    async function loadSession() {
      try {
        const { data: session } = await supabase
          .from('user_sessions')
          .select('resume_text, job_titles')
          .eq('id', sessionId)
          .single()

        if (session) {
          setResumeText(session.resume_text)
          setJobTitles(session.job_titles || [])
        }

        const { data: jobs } = await supabase
          .from('ai_jobs')
          .select('*')
          .eq('session_id', sessionId)
          .order('relevancy_score', { ascending: false, nullsFirst: false })

        if (jobs) {
          setAiJobs(jobs)
        }
      } catch (err) {
        console.error('Failed to load session:', err)
      }
    }

    loadSession()
  }, [sessionId])

  // Parse resume text via edge function (now with auth)
  const parseResume = useCallback(async (text) => {
    setLoading(true)
    setStep('parsing')
    setError(null)

    try {
      const data = await api.parseResume(text)

      localStorage.setItem(SESSION_KEY, data.session_id)
      setSessionId(data.session_id)
      setResumeText(text)
      setJobTitles(data.job_titles)

      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
      setStep('')
    }
  }, [])

  // Fetch jobs via edge function (now with auth)
  const fetchJobs = useCallback(async () => {
    if (!sessionId || jobTitles.length === 0) return

    setLoading(true)
    setStep('fetching')
    setError(null)

    try {
      const data = await api.fetchJobs(sessionId, jobTitles)

      setAiJobs(data.jobs || [])
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
      setStep('')
    }
  }, [sessionId, jobTitles])

  // Score jobs via edge function (now with auth)
  const scoreJobs = useCallback(async () => {
    if (!sessionId) return

    setLoading(true)
    setStep('scoring')
    setError(null)

    try {
      const data = await api.scoreJobs(sessionId)

      setAiJobs(data.jobs || [])
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
      setStep('')
    }
  }, [sessionId])

  // Rewrite resume for a specific job (now with auth)
  const rewriteResume = useCallback(async (jobId) => {
    if (!sessionId) return

    setLoading(true)
    setStep('rewriting')
    setError(null)

    try {
      const data = await api.rewriteResume(sessionId, { job_id: jobId })
      return data.rewritten_resume
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
      setStep('')
    }
  }, [sessionId])

  // Check Apify credits (now with auth)
  const checkCredits = useCallback(async () => {
    try {
      return await api.checkCredits()
    } catch {
      return null
    }
  }, [])

  // Clear session
  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setSessionId(null)
    setResumeText('')
    setJobTitles([])
    setAiJobs([])
    setError(null)
  }, [])

  return {
    sessionId,
    resumeText,
    jobTitles,
    aiJobs,
    loading,
    step,
    error,
    parseResume,
    fetchJobs,
    scoreJobs,
    rewriteResume,
    checkCredits,
    clearSession,
  }
}
