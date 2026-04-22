/**
 * Centralized API service for all Supabase Edge Function calls.
 * - Derives the functions URL from the Supabase client URL
 * - Automatically attaches the user's JWT Authorization header
 * - Provides consistent error handling
 */
import { supabase } from '../hooks/useSupabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`

/**
 * Get the current session's access token.
 */
async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Not authenticated. Please sign in.')
  }
  return `Bearer ${session.access_token}`
}

/**
 * Call a Supabase Edge Function with authentication.
 */
async function callFunction(functionName, body = {}) {
  const authToken = await getAuthHeader()

  const resp = await fetch(`${FUNCTIONS_URL}/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authToken,
    },
    body: JSON.stringify(body),
  })

  const data = await resp.json()

  if (!resp.ok) {
    throw new Error(data.error || `${functionName} failed with status ${resp.status}`)
  }

  return data
}

/**
 * Parse a resume and get job titles.
 * @param {string} resumeText - Extracted resume text
 * @returns {{ session_id: string, job_titles: string[] }}
 */
export async function parseResume(resumeText) {
  return callFunction('parse-resume', { resume_text: resumeText })
}

/**
 * Fetch jobs from LinkedIn via Apify for the given session.
 * @param {string} sessionId
 * @param {string[]} jobTitles
 * @returns {{ jobs: object[], cached: boolean, message: string }}
 */
export async function fetchJobs(sessionId, jobTitles) {
  return callFunction('fetch-jobs', { session_id: sessionId, job_titles: jobTitles })
}

/**
 * Score jobs against a resume using AI.
 * @param {string} sessionId
 * @returns {{ jobs: object[], message: string }}
 */
export async function scoreJobs(sessionId) {
  return callFunction('score-jobs', { session_id: sessionId })
}

/**
 * Rewrite/tailor a resume for a specific job.
 * @param {string} sessionId
 * @param {{ job_id?: number, custom_jd?: string, custom_title?: string, custom_company?: string }} options
 * @returns {{ rewritten_resume: string }}
 */
export async function rewriteResume(sessionId, options = {}) {
  return callFunction('rewrite-resume', { session_id: sessionId, ...options })
}

/**
 * Check Apify credit usage.
 * @returns {{ used: number, limit: number, remaining: number, remaining_percent: number, estimated_runs: number }}
 */
export async function checkCredits() {
  return callFunction('check-credits')
}
