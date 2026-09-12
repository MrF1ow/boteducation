'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/supabase/tenant'
import { getUserRole } from '@/lib/supabase/get-user-role'
import { revalidatePath } from 'next/cache'
import { sendEmail } from '@/lib/email/send'
import { isMailerConfigured } from '@/lib/email/status'
import { courseRemovedTemplate } from '@/lib/email/templates/course-removed'
import { getLocale } from 'next-intl/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reconcileAccessCutoffSafely } from '@/lib/billing/access-cutoff'
import { ANALYTICS_EVENTS } from '@/lib/analytics/events'
import { track, safeAnalytics } from '@/lib/analytics/server'
import { evaluateSchoolActivation } from '@/lib/analytics/activation'

export interface CourseFormData {
  title: string
  description?: string | null
  thumbnail_url?: string | null
  category_id?: number | null
  status?: 'draft' | 'published' | 'archived'
  learning_objectives?: string[] | null
  estimated_duration_minutes?: number | null
}

const MAX_OBJECTIVES = 20
const MAX_OBJECTIVE_LENGTH = 300
const MAX_DURATION_MINUTES = 60000

// Writes go through the admin client (service role), so sanitize here rather
// than relying on RLS/constraints alone.
function sanitizeObjectives(input: string[] | null | undefined): string[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((objective): objective is string => typeof objective === 'string')
    .map((objective) => objective.trim().slice(0, MAX_OBJECTIVE_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_OBJECTIVES)
}

function sanitizeDuration(minutes: number | null | undefined): number | null {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return null
  const rounded = Math.round(minutes)
  return rounded > 0 ? Math.min(rounded, MAX_DURATION_MINUTES) : null
}

/**
 * Create a new course
 */
export async function createCourse(courseData: CourseFormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = await getUserRole()
  const tenantId = await getCurrentTenantId()

  if (!user) {
    throw new Error('Not authenticated')
  }

  if (role !== 'teacher' && role !== 'admin') {
    throw new Error('Unauthorized: Only teachers and admins can create courses')
  }

  // Use admin client for insert — auth and role are already validated above.
  // The user's JWT may have stale tenant_role claims that don't match the
  // RLS policy on courses (requires tenant_role = teacher|admin in JWT).
  const adminClient = createAdminClient()

  // Ensure profile exists (FK courses_author_profile_fkey requires it).
  // The on_auth_user_created trigger should create profiles, but as a safety
  // net for accounts created before the trigger was added, upsert here.
  await adminClient
    .from('profiles')
    .upsert(
      { id: user.id, full_name: user.user_metadata?.full_name || null },
      { onConflict: 'id', ignoreDuplicates: true }
    )

  const { data: course, error } = await adminClient
    .from('courses')
    .insert({
      title: courseData.title,
      description: courseData.description || null,
      thumbnail_url: courseData.thumbnail_url || null,
      category_id: courseData.category_id || null,
      author_id: user.id,
      tenant_id: tenantId,
      status: courseData.status || 'draft',
      learning_objectives: sanitizeObjectives(courseData.learning_objectives),
      estimated_duration_minutes: sanitizeDuration(courseData.estimated_duration_minutes),
    })
    .select('course_id')
    .single()

  if (error) {
    console.error('Failed to create course:', error)
    throw new Error(`Failed to create course: ${error.message}`)
  }

  // Usage-change follow-up. The reconciler is a no-op after leftover cleanup
  // PR-01; keep the call so archive/delete paths stay in one pattern.
  await reconcileAccessCutoffSafely(adminClient, tenantId)

  await track(
    ANALYTICS_EVENTS.COURSE_CREATED,
    {
      course_id: course.course_id,
      via: 'manual',
      status: courseData.status || 'draft',
    },
    { userId: user.id, tenantId, role }
  )

  // A course created straight into `published` is the one case where creation
  // can complete the activation condition on its own.
  if ((courseData.status || 'draft') === 'published') {
    await track(
      ANALYTICS_EVENTS.COURSE_PUBLISHED,
      { course_id: course.course_id, lesson_count: 0, days_since_course_created: 0 },
      { userId: user.id, tenantId, role }
    )
    await evaluateSchoolActivation({ tenantId, userId: user.id, role })
  }

  revalidatePath('/dashboard/teacher/courses')
  return course
}

/**
 * Update an existing course
 */
export async function updateCourse(courseId: number, courseData: CourseFormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = await getUserRole()
  const tenantId = await getCurrentTenantId()

  if (!user) {
    throw new Error('Not authenticated')
  }

  if (role !== 'teacher' && role !== 'admin') {
    throw new Error('Unauthorized: Only teachers and admins can update courses')
  }

  // Verify course belongs to user or user is admin. `status` and `created_at`
  // ride along for the `course_published` transition check below — this select
  // already happens, so detecting the transition costs no extra round trip.
  const { data: existingCourse } = await supabase
    .from('courses')
    .select('author_id, tenant_id, status, created_at')
    .eq('course_id', courseId)
    .eq('tenant_id', tenantId)
    .single()

  if (!existingCourse) {
    throw new Error('Course not found')
  }

  if (role !== 'admin' && existingCourse.author_id !== user.id) {
    throw new Error('Unauthorized: You can only update your own courses')
  }

  // Use admin client — auth and ownership validated above, JWT tenant_role may be stale
  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('courses')
    .update({
      title: courseData.title,
      description: courseData.description || null,
      thumbnail_url: courseData.thumbnail_url || null,
      category_id: courseData.category_id || null,
      status: courseData.status || undefined,
      learning_objectives: sanitizeObjectives(courseData.learning_objectives),
      estimated_duration_minutes: sanitizeDuration(courseData.estimated_duration_minutes),
    })
    .eq('course_id', courseId)
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('Failed to update course:', error)
    throw new Error(`Failed to update course: ${error.message}`)
  }

  // TRANSITION DETECTION, not "did this save write `status`". `updateCourse` is
  // a generic save that happens to carry `status`, so firing on every call would
  // emit `course_published` each time an already-live course is edited —
  // inflating the one metric Loop B exists to produce. Only not-published →
  // published counts, and `status: undefined` above means the field was left
  // alone, which is never a publish.
  const nextStatus = courseData.status
  if (nextStatus === 'published' && existingCourse.status !== 'published') {
    // Wrapped: the `lessons` count exists only to populate `lesson_count`, and
    // the course is already published by now — an analytics read must not throw
    // "Failed to update course" at a save that succeeded.
    await safeAnalytics(async () => {
      const { count: lessonCount } = await adminClient
        .from('lessons')
        .select('id', { count: 'exact', head: true })
        .eq('course_id', courseId)
        .eq('tenant_id', tenantId)

      const createdAt = existingCourse.created_at
        ? new Date(existingCourse.created_at)
        : null

      await track(
        ANALYTICS_EVENTS.COURSE_PUBLISHED,
        {
          course_id: courseId,
          lesson_count: lessonCount ?? 0,
          days_since_course_created:
            createdAt && !Number.isNaN(createdAt.getTime())
              ? Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 86_400_000))
              : null,
          previous_status: existingCourse.status,
        },
        { userId: user.id, tenantId, role }
      )

      // Publishing is one of the two events that can complete activation.
      await evaluateSchoolActivation({ tenantId, userId: user.id, role })
    }, 'course_published')
  }

  revalidatePath('/dashboard/teacher/courses')
  revalidatePath(`/dashboard/teacher/courses/${courseId}`)
  return { success: true }
}

/**
 * Check enrollment count before deleting a course.
 * Returns { enrollmentCount, canDelete } for the UI to decide.
 */
export async function getCourseEnrollmentCount(courseId: number) {
  const supabase = await createClient()
  const tenantId = await getCurrentTenantId()

  const { count } = await supabase
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')

  return { enrollmentCount: count ?? 0 }
}

/**
 * Archive a course (safe alternative to delete — enrolled students keep access).
 */
export async function archiveCourse(courseId: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = await getUserRole()
  const tenantId = await getCurrentTenantId()

  if (!user) throw new Error('Not authenticated')
  if (role !== 'teacher' && role !== 'admin') throw new Error('Unauthorized')

  const { data: existingCourse } = await supabase
    .from('courses')
    .select('author_id')
    .eq('course_id', courseId)
    .eq('tenant_id', tenantId)
    .single()

  if (!existingCourse) throw new Error('Course not found')
  if (role !== 'admin' && existingCourse.author_id !== user.id) throw new Error('Unauthorized')

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('courses')
    .update({ status: 'archived' })
    .eq('course_id', courseId)
    .eq('tenant_id', tenantId)

  if (error) throw new Error('Failed to archive course')

  // Archiving is the remediation the cutoff email asks for by name ("N active
  // courses exceed the X plan's limit of M"), and `countTenantUsage` excludes
  // archived courses — so this is the moment the school may have come back
  // under its limit. Reconciling here is what makes compliance take effect
  // immediately instead of at the next daily sweep, or never (#550, #513).
  await reconcileAccessCutoffSafely(adminClient, tenantId)

  revalidatePath('/dashboard/teacher/courses')
  revalidatePath(`/dashboard/teacher/courses/${courseId}`)
  return { success: true }
}

/**
 * Best-effort request locale for outbound email copy. `getLocale()` throws
 * outside a request scope; an unknown locale falls back to English.
 */
async function requestLocale(): Promise<string | undefined> {
  try {
    return await getLocale()
  } catch {
    return undefined
  }
}

/**
 * Delete a course. Sends email to enrolled students if any.
 * Requires explicit confirmation — use getCourseEnrollmentCount first to warn the UI.
 */
export async function deleteCourse(courseId: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = await getUserRole()
  const tenantId = await getCurrentTenantId()

  if (!user) throw new Error('Not authenticated')
  if (role !== 'teacher' && role !== 'admin') throw new Error('Unauthorized')

  // Verify ownership
  const { data: course } = await supabase
    .from('courses')
    .select('course_id, author_id, title, tenant_id')
    .eq('course_id', courseId)
    .eq('tenant_id', tenantId)
    .single()

  if (!course) throw new Error('Course not found')
  if (role !== 'admin' && course.author_id !== user.id) throw new Error('Unauthorized')

  const adminClient = createAdminClient()

  // Notify enrolled students before deleting. `sendEmail()` returns false when
  // the platform mailer is not configured, and the dialog tells the teacher how
  // many students were NOT reached rather than implying everyone was (#676).
  const notification = { recipients: 0, emailsSent: 0, mailerConfigured: isMailerConfigured() }
  try {
    const { data: enrollments } = await adminClient
      .from('enrollments')
      .select('user_id')
      .eq('course_id', courseId)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')

    notification.recipients = enrollments?.length ?? 0

    if (notification.recipients > 0 && notification.mailerConfigured) {
      const [{ data: tenantRow }, locale, authUsers] = await Promise.all([
        adminClient.from('tenants').select('name').eq('id', tenantId).single(),
        requestLocale(),
        // One round-trip per student, but in parallel — `auth.admin` has no
        // "get users by ids", and `listUsers` pages the whole instance.
        Promise.all(
          (enrollments || []).map((enrollment) => adminClient.auth.admin.getUserById(enrollment.user_id))
        ),
      ])

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com'
      const template = courseRemovedTemplate({
        courseTitle: course.title,
        schoolName: tenantRow?.name || 'LMS Platform',
        browseUrl: `${appUrl}/dashboard/student/browse`,
        locale,
      })

      const recipients = authUsers
        .map(({ data }) => data?.user?.email)
        .filter((email): email is string => Boolean(email))
      const results = await Promise.all(recipients.map((to) => sendEmail({ to, ...template })))
      notification.emailsSent = results.filter(Boolean).length
    }
  } catch (emailErr) {
    console.error('Failed to notify students of course deletion:', emailErr)
  }

  // Delete the course (cascade will handle lessons, exams, etc.)
  // adminClient already created above for email notifications
  const { error } = await adminClient
    .from('courses')
    .delete()
    .eq('course_id', courseId)
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('Failed to delete course:', error)
    throw new Error('Failed to delete course')
  }

  // Same reason as `archiveCourse` above — deletion drops the course count too.
  await reconcileAccessCutoffSafely(adminClient, tenantId)

  revalidatePath('/dashboard/teacher/courses')
  return { success: true, ...notification }
}
