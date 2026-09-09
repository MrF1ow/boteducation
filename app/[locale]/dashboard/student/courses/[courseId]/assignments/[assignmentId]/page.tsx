import { createClient } from '@/lib/supabase/server'
import { getCurrentUserId } from '@/lib/supabase/tenant'
import { requireCourseAccess, requireRowInCourse } from '@/lib/services/course-access-guard'
import { redirect, notFound } from 'next/navigation'
import { getFormatter, getTranslations } from 'next-intl/server'
import { CourseWorkNav } from '@/components/student/course-work-nav'
import BreadcrumbComponent from '@/components/exercises/breadcrumb-component'
import { AssignmentSubmitForm } from '@/components/student/assignment-submit-form'
import {
  decideSubmissionWrite,
  parseLatePolicy,
  type LatePolicy,
} from '@/lib/assignments/late-policy'
import { Badge } from '@/components/ui/badge'

interface PageProps {
  params: Promise<{ courseId: string; assignmentId: string }>
}

function policyCopy(
  policy: LatePolicy,
  t: Awaited<ReturnType<typeof getTranslations>>,
  format: Awaited<ReturnType<typeof getFormatter>>,
): string {
  switch (policy.kind) {
    case 'reject':
      return t('latePolicy.reject')
    case 'accept':
      return t('latePolicy.accept')
    case 'accept_until':
      return t('latePolicy.acceptUntil', {
        until: format.dateTime(new Date(policy.until), { dateStyle: 'medium', timeStyle: 'short' }),
      })
    case 'penalize':
      return t('latePolicy.penalize', { percent: policy.percent_per_day })
    default: {
      const _exhaustive: never = policy
      return _exhaustive
    }
  }
}

export default async function AssignmentDetailPage({ params }: PageProps) {
  const { courseId, assignmentId } = await params
  const numericCourseId = parseInt(courseId, 10)
  const numericAssignmentId = parseInt(assignmentId, 10)
  if (!Number.isInteger(numericCourseId) || !Number.isInteger(numericAssignmentId)) {
    notFound()
  }

  const supabase = await createClient()
  const userId = await getCurrentUserId()
  if (!userId) redirect('/auth/login')
  await requireCourseAccess(supabase, userId, numericCourseId)

  const t = await getTranslations('studentCourseWork')
  const format = await getFormatter()

  const { data: assignment } = await supabase
    .from('assignments')
    .select('assignment_id, course_id, title, body, due_at, late_policy, max_score, rubric, published')
    .eq('assignment_id', numericAssignmentId)
    .maybeSingle()

  if (!assignment || !assignment.published) notFound()
  requireRowInCourse(assignment.course_id, numericCourseId)

  const [{ data: course }, { data: submission }] = await Promise.all([
    supabase.from('courses').select('title').eq('course_id', numericCourseId).maybeSingle(),
    supabase
      .from('submissions')
      .select('submission_id, status, submitted_at, body')
      .eq('assignment_id', numericAssignmentId)
      .eq('student_id', userId)
      .maybeSingle(),
  ])

  if (!course) notFound()

  const policy = parseLatePolicy(assignment.late_policy)
  const write = decideSubmissionWrite(
    assignment.due_at,
    policy,
    new Date(),
    submission?.status ?? null,
  )
  const canSubmit = write.ok

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <BreadcrumbComponent
        links={[
          { href: '/dashboard/student', label: t('nav.course') },
          { href: `/dashboard/student/courses/${courseId}`, label: course.title },
          { href: `/dashboard/student/courses/${courseId}/assignments`, label: t('nav.assignments') },
          { href: '#', label: assignment.title },
        ]}
      />
      <CourseWorkNav courseId={courseId} current="assignments" />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{assignment.title}</h1>
        <p className="text-sm text-muted-foreground">
          {assignment.due_at
            ? t('due', {
                date: format.dateTime(new Date(assignment.due_at), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }),
              })
            : t('noDue')}
        </p>
        <p className="text-sm">{t('maxScore', { score: assignment.max_score })}</p>
        <p className="text-sm text-muted-foreground">{policyCopy(policy, t, format)}</p>
      </div>
      {assignment.body ? (
        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
          {assignment.body}
        </div>
      ) : null}
      {assignment.rubric ? (
        <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
          {JSON.stringify(assignment.rubric, null, 2)}
        </pre>
      ) : null}
      {submission?.submitted_at ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>
            {t('submitted', {
              date: format.dateTime(new Date(submission.submitted_at), {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            })}
          </span>
          {submission.status === 'late' ? <Badge variant="outline">{t('late')}</Badge> : null}
        </div>
      ) : null}
      {submission?.body ? (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
          {submission.body}
        </div>
      ) : null}
      <AssignmentSubmitForm
        assignmentId={numericAssignmentId}
        courseId={numericCourseId}
        canSubmit={canSubmit}
      />
    </div>
  )
}
