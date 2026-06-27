/**
 * Hand-written row types mirroring supabase/migrations/*.sql.
 * Not a generated Database<> type — the project has no linked Supabase CLI
 * config, so these are kept in sync by hand as migrations are added.
 */

export type WorkMode = 'Remote' | 'Hybrid' | 'On-site'
export type Platform = 'LinkedIn' | 'Naukri' | 'Indeed'
export type Grade = 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F'
export type Archetype =
  | 'Dream Job'
  | 'Strong Match'
  | 'Worth Trying'
  | 'Stretch'
  | 'Safety'
  | 'Mismatch'
  | 'Dealbreaker'
export type Recommendation = 'Apply Now' | 'Worth Trying' | 'Maybe Later' | 'Skip'
export type TrackerStatus = 'Applied' | 'Interview' | 'Offer' | 'Rejected'
export type JobStatus = 'active' | string

/** `jobs` table (base schema + work_mode + ghost/status columns). */
export interface Job {
  id: number
  title: string
  company: string
  location: string | null
  url: string | null
  platform: Platform | null
  role_type: string | null
  salary: string | null
  description: string | null
  posted_date: string | null
  dedup_key: string | null
  work_mode: WorkMode | null
  is_duplicate: boolean
  is_ghost: boolean
  status: JobStatus
  apify_run_id: string | null
  experience: string | null
  company_size: string | null
  scraped_at: string | null
  created_at: string
}

/** `profiles` table. */
export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  headline: string | null
  base_resume: string | null
  bio: string | null
  skills: string[]
  preferred_roles: string[]
  preferred_locations: string[]
  min_salary: number | null
  experience_years: number | null
  created_at: string
  updated_at: string
}

/** `evaluations` table — 5-dimension AI scoring per user x job. */
export interface Evaluation {
  id: string
  user_id: string
  job_id: number
  session_id: string | null
  technical_fit: number | null
  seniority_fit: number | null
  domain_fit: number | null
  salary_fit: number | null
  location_fit: number | null
  overall_score: number | null
  grade: Grade | null
  archetype: Archetype | null
  gate_fail: string | null
  recommendation: Recommendation | null
  reasons: string[]
  risks: string[]
  summary: string | null
  model_used: string
  evaluated_at: string
  jobs?: Pick<
    Job,
    | 'id'
    | 'title'
    | 'company'
    | 'location'
    | 'url'
    | 'platform'
    | 'role_type'
    | 'salary'
    | 'work_mode'
    | 'posted_date'
  >
}

/** `resumes` table — tailored resume versions. */
export interface Resume {
  id: string
  user_id: string
  job_id: number | null
  session_id: string | null
  original_text: string
  tailored_text: string
  keywords_added: string[]
  ats_score: number | null
  version: number
  created_at: string
}

/** `application_tracker` table. */
export interface ApplicationTracker {
  id: string
  user_id: string
  job_id: number | null
  title: string | null
  company: string | null
  status: TrackerStatus
  notes: string | null
  applied_date: string
  created_at: string
  updated_at: string
}

/** `user_sessions` table — resume-parse session for the (legacy) anonymous AI flow. */
export interface UserSession {
  id: string
  user_id: string | null
  resume_text: string
  job_titles: string[]
  ip_address: string | null
  created_at: string
}

/** `ai_jobs` table — session-scoped AI-matched jobs (legacy flow). */
export interface AiJob {
  id: number
  session_id: string
  title: string
  company: string
  location: string | null
  salary: string | null
  experience: string | null
  jd_text: string | null
  relevancy_score: number | null
  salary_match: string | null
  experience_match: boolean | null
  reasons: string[] | null
  summary: string | null
  portal_url: string | null
  fetched_at: string
}
