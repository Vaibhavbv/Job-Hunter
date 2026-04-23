import { useState, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './useSupabase'
import { useJobs } from './useJobs'
import * as api from '../services/api'

/**
 * Hook for the 5-dimension job evaluation system.
 * Fetches evaluations from the DB and provides methods to trigger new evaluations.
 */
export function useEvaluations() {
  const queryClient = useQueryClient()
  const { allJobs } = useJobs()
  const [evaluating, setEvaluating] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' })

  // ---------------------------------------------------------------------------
  // Fetch all evaluations for the current user
  // ---------------------------------------------------------------------------
  const {
    data: evaluations = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['evaluations'],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('evaluations')
        .select(`
          *,
          jobs:job_id (
            id, title, company, location, url, platform,
            role_type, salary, work_mode, posted_date
          )
        `)
        .order('overall_score', { ascending: false })

      if (err) throw err
      return data || []
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  // ---------------------------------------------------------------------------
  // Evaluate jobs (calls edge function)
  // ---------------------------------------------------------------------------
  // Count of unevaluated jobs
  const pendingCount = useMemo(() => {
    const evaluatedJobIds = new Set(evaluations.map(e => e.job_id))
    return allJobs.filter(j => !evaluatedJobIds.has(j.id)).length
  }, [allJobs, evaluations])

  /**
   * Evaluate jobs. If jobIds is empty, evaluates all pending jobs in batches.
   * Progress is tracked between each call to the edge function.
   */
  const evaluate = useCallback(async (jobIds = [], sessionId = null) => {
    setEvaluating(true)
    let totalNew = 0

    try {
      if (jobIds.length > 0) {
        // Evaluate specific jobs
        setProgress({ current: 0, total: jobIds.length, message: 'Evaluating selected jobs...' })
        const result = await api.evaluateJobs({
          job_ids: jobIds,
          session_id: sessionId || undefined,
        })
        totalNew = result.new_count || 0
        setProgress({ current: totalNew, total: jobIds.length, message: 'Complete!' })
      } else {
        // Batch evaluate ALL pending — loop until no new evaluations
        const estimatedTotal = pendingCount || 20
        setProgress({ current: 0, total: estimatedTotal, message: 'Starting batch evaluation...' })

        let round = 0
        const MAX_ROUNDS = 10 // Safety limit

        while (round < MAX_ROUNDS) {
          round++
          setProgress(prev => ({ ...prev, message: `Batch ${round}: evaluating up to 20 jobs...` }))

          const result = await api.evaluateJobs({
            session_id: sessionId || undefined,
          })

          const batchNew = result.new_count || 0
          totalNew += batchNew

          setProgress({
            current: totalNew,
            total: estimatedTotal,
            message: batchNew > 0
              ? `Evaluated ${totalNew} jobs so far...`
              : 'All jobs evaluated!',
          })

          // Stop if no new evaluations were created this round
          if (batchNew === 0) break
        }
      }

      // Refresh evaluation data
      queryClient.invalidateQueries({ queryKey: ['evaluations'] })
      return { new_count: totalNew }
    } finally {
      setEvaluating(false)
      setProgress({ current: 0, total: 0, message: '' })
    }
  }, [queryClient, pendingCount])

  // ---------------------------------------------------------------------------
  // Computed stats
  // ---------------------------------------------------------------------------
  const stats = useMemo(() => {
    if (evaluations.length === 0) {
      return {
        total: 0,
        avgScore: 0,
        gradeDistribution: {},
        archetypeDistribution: {},
        topJobs: [],
        gateFailCount: 0,
      }
    }

    const scores = evaluations.map(e => e.overall_score).filter(Boolean)
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0

    // Grade distribution
    const gradeDistribution = {}
    for (const e of evaluations) {
      gradeDistribution[e.grade] = (gradeDistribution[e.grade] || 0) + 1
    }

    // Archetype distribution
    const archetypeDistribution = {}
    for (const e of evaluations) {
      archetypeDistribution[e.archetype] = (archetypeDistribution[e.archetype] || 0) + 1
    }

    // Top 5 jobs
    const topJobs = evaluations
      .filter(e => !e.gate_fail)
      .slice(0, 5)

    // Gate fail count
    const gateFailCount = evaluations.filter(e => e.gate_fail).length

    return {
      total: evaluations.length,
      avgScore,
      gradeDistribution,
      archetypeDistribution,
      topJobs,
      gateFailCount,
    }
  }, [evaluations])

  // ---------------------------------------------------------------------------
  // Filtering helpers
  // ---------------------------------------------------------------------------
  const getByGrade = useCallback((grade) => {
    return evaluations.filter(e => e.grade === grade)
  }, [evaluations])

  const getByArchetype = useCallback((archetype) => {
    return evaluations.filter(e => e.archetype === archetype)
  }, [evaluations])

  const getByRecommendation = useCallback((recommendation) => {
    return evaluations.filter(e => e.recommendation === recommendation)
  }, [evaluations])

  const getTopN = useCallback((n = 10) => {
    return evaluations
      .filter(e => !e.gate_fail)
      .slice(0, n)
  }, [evaluations])

  return {
    evaluations,
    loading,
    error: error?.message || null,
    evaluating,
    progress,
    pendingCount,
    stats,
    evaluate,
    refetch,
    getByGrade,
    getByArchetype,
    getByRecommendation,
    getTopN,
  }
}
