'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUserId } from '@/lib/supabase/tenant'
import { revalidatePath } from 'next/cache'
import {
  decideSubmissionWrite,
  parseLatePolicy,
} from '@/lib/assignments/late-policy'
import { requireCourseAccess } from '@/lib/services/course-access-guard'

export type SubmitAssignmentState = {
  error?: string
  status?: string
  submittedAt?: string
} | null

export async function submitAssignment(
  _prev: SubmitAssignmentState,
  formData: FormData,
): Promise<SubmitAssignmentState> {
  const assignmentId = Number(formData.get('assignmentId'))
  const courseId = Number(formData.get('courseId'))
  const body = String(formData.get('body') ?? '').trim()
  if (!Number.isInteger(assignmentId) || !Number.isInteger(courseId)) {
    return { error: 'Invalid assignment' }
  }
  if (!body) {
    return { error: 'empty' }
  }

  const supabase = await createClient()
  const userId = await getCurrentUserId()
  if (!userId) {
    return { error: 'Not signed in' }
  }

  await requireCourseAccess(supabase, userId, courseId)

  const { data: assignment, error: assignmentError } = await supabase
    .from('assignments')
    .select('assignment_id, course_id, due_at, late_policy, published')
    .eq('assignment_id', assignmentId)
    .maybeSingle()

  if (
    assignmentError ||
    !assignment ||
    assignment.course_id !== courseId ||
    !assignment.published
  ) {
    return { error: 'Assignment not found' }
  }

  const { data: existing } = await supabase
    .from('submissions')
    .select('submission_id, status')
    .eq('assignment_id', assignmentId)
    .eq('student_id', userId)
    .maybeSingle()

  const decision = decideSubmissionWrite(
    assignment.due_at,
    parseLatePolicy(assignment.late_policy),
    new Date(),
    existing?.status ?? null,
  )
  if (!decision.ok) {
    return { error: decision.reason }
  }

  const now = new Date().toISOString()
  const payload = {
    assignment_id: assignmentId,
    student_id: userId,
    body,
    status: decision.status,
    submitted_at: now,
    files: [] as string[],
  }

  if (existing?.submission_id) {
    const { error } = await supabase
      .from('submissions')
      .update(payload)
      .eq('submission_id', existing.submission_id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('submissions').insert(payload)
    if (error) return { error: error.message }
  }

  revalidatePath(`/dashboard/student/courses/${courseId}/assignments/${assignmentId}`)
  revalidatePath(`/dashboard/student/courses/${courseId}/assignments`)
  revalidatePath(`/dashboard/student/courses/${courseId}/grades`)
  return { status: decision.status, submittedAt: now }
}
