'use client'

/**
 * Enrollment Hook
 *
 * Client-side hook for tenant members to self-enroll in a published school
 * course. Delegates to self_enroll_school_course (SECURITY DEFINER). No
 * subscription row is required.
 */

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAnalytics } from '@/lib/analytics/client'
import { ANALYTICS_EVENTS } from '@/lib/analytics/events'

export function useEnrollment() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const analytics = useAnalytics()

  /**
   * Self-enroll the current user in a published course of their school.
   * @param courseId - Course to enroll in
   */
  const enrollInCourse = async (courseId: number) => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: rpcError } = await supabase.rpc('self_enroll_school_course', {
        _course_id: courseId,
      })

      if (rpcError) {
        throw new Error(rpcError.message)
      }

      analytics.track(ANALYTICS_EVENTS.COURSE_SELF_ENROLLED, {
        course_id: courseId,
        source: 'membership',
      })

      toast.success('Successfully enrolled in course!')
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to enroll'
      setError(message)
      toast.error(message)
      console.error('Enrollment error:', err)
    } finally {
      setLoading(false)
    }
  }

  return {
    enrollInCourse,
    loading,
    error,
  }
}
