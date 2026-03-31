import { useState, useEffect, useCallback } from 'react'
import { supabase } from './useSupabase'

const SESSION_KEY = 'jh_session_id'
const SUPABASE_FUNCTIONS_URL = 'https://qlvnnrmilwfxzlotduld.supabase.co/functions/v1'

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

  // Parse resume text via edge function
  const parseResume = useCallback(async (text) => {
    setLoading(true)
    setStep('parsing')
    setError(null)

    try {
      const resp = await fetch(`${SUPABASE_FUNCTIONS_URL}/parse-resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_text: text }),
      })

      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Failed to parse resume')

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

  // Fetch jobs via edge function
  const fetchJobs = useCallback(async () => {
    if (!sessionId || jobTitles.length === 0) return

    setLoading(true)
    setStep('fetching')
    setError(null)

    try {
      const resp = await fetch(`${SUPABASE_FUNCTIONS_URL}/fetch-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, job_titles: jobTitles }),
      })

      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Failed to fetch jobs')

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

  // Score jobs via edge function
  const scoreJobs = useCallback(async () => {
    if (!sessionId) return

    setLoading(true)
    setStep('scoring')
    setError(null)

    try {
      const resp = await fetch(`${SUPABASE_FUNCTIONS_URL}/score-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })

      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Failed to score jobs')

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

  // Rewrite resume for a specific job
  const rewriteResume = useCallback(async (jobId) => {
    if (!sessionId) return

    setLoading(true)
    setStep('rewriting')
    setError(null)

    try {
      const resp = await fetch(`${SUPABASE_FUNCTIONS_URL}/rewrite-resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, job_id: jobId }),
      })

      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Failed to rewrite resume')

      return data.rewritten_resume
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
      setStep('')
    }
  }, [sessionId])

  // Check Apify credits
  const checkCredits = useCallback(async () => {
    try {
      const resp = await fetch(`${SUPABASE_FUNCTIONS_URL}/check-credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const data = await resp.json()
      if (!resp.ok) return null

      return data
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
