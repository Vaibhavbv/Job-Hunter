/**
 * Centralized API service for all Supabase Edge Function calls.
 * - Derives the functions URL from the Supabase client URL
 * - Automatically attaches the user's JWT Authorization header
 * - Provides consistent error handling
 */
import { supabase } from '../hooks/useSupabase'
import type { AiJob } from '../types/database'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`

async function getAuthHeader(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Not authenticated. Please sign in.')
  }
  return `Bearer ${session.access_token}`
}

async function callFunction<T = unknown>(functionName: string, body: object = {}): Promise<T> {
  const authToken = await getAuthHeader()

  const resp = await fetch(`${FUNCTIONS_URL}/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authToken,
    },
    body: JSON.stringify(body),
  })

  const data = await resp.json()

  if (!resp.ok) {
    throw new Error(data.error || `${functionName} failed with status ${resp.status}`)
  }

  return data
}

// ---------------------------------------------------------------------------
// Resume operations
// ---------------------------------------------------------------------------

export interface ParseResumeResult {
  session_id: string
  job_titles: string[]
}

/** Parse a resume and get job titles. */
export async function parseResume(resumeText: string): Promise<ParseResumeResult> {
  return callFunction('parse-resume', { resume_text: resumeText })
}

export interface RewriteResumeOptions {
  job_id?: number
  custom_jd?: string
  custom_title?: string
  custom_company?: string
}

export interface RewriteResumeResult {
  rewritten_resume: string
  resume_id: string
  keywords_added: string[]
  ats_score: number
  changes_summary: string
}

/** Rewrite/tailor a resume for a specific job. */
export async function rewriteResume(
  sessionId: string,
  options: RewriteResumeOptions = {},
): Promise<RewriteResumeResult> {
  return callFunction('rewrite-resume', { session_id: sessionId, ...options })
}

// ---------------------------------------------------------------------------
// Job fetching
// ---------------------------------------------------------------------------

export interface FetchJobsResult {
  jobs: AiJob[]
  cached: boolean
  message: string
}

/** Fetch jobs from LinkedIn via Apify for the given session. */
export async function fetchJobs(
  sessionId: string,
  jobTitles: string[],
): Promise<FetchJobsResult> {
  return callFunction('fetch-jobs', { session_id: sessionId, job_titles: jobTitles })
}

// ---------------------------------------------------------------------------
// Job evaluation
// ---------------------------------------------------------------------------

export interface EvaluateJobsOptions {
  job_ids?: number[]
  session_id?: string
}

export interface EvaluateJobsResult {
  evaluations: Record<string, unknown>[]
  new_count: number
  message: string
}

/** Evaluate jobs using the 5-dimension scoring system. */
export async function evaluateJobs(
  options: EvaluateJobsOptions = {},
): Promise<EvaluateJobsResult> {
  return callFunction('evaluate-jobs', options)
}

export interface ScoreJobsResult {
  jobs: AiJob[]
  message: string
}

/** Score jobs against a resume using AI. (Legacy — kept for backward compat) */
export async function scoreJobs(sessionId: string): Promise<ScoreJobsResult> {
  return callFunction('score-jobs', { session_id: sessionId })
}

// ---------------------------------------------------------------------------
// Credits
// ---------------------------------------------------------------------------

export interface CheckCreditsResult {
  used: number
  limit: number
  remaining: number
  remaining_percent: number
  estimated_runs: number
}

/** Check Apify credit usage. */
export async function checkCredits(): Promise<CheckCreditsResult> {
  return callFunction('check-credits')
}
