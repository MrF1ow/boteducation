import { createClient } from '@/lib/supabase/server'
import { getCurrentUserId } from '@/lib/supabase/tenant'
import { requireCourseAccess } from '@/lib/services/course-access-guard'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getFormatter, getTranslations } from 'next-intl/server'
import { CourseWorkNav } from '@/components/student/course-work-nav'
import BreadcrumbComponent from '@/components/exercises/breadcrumb-component'

interface PageProps {
  params: Promise<{ courseId: string }>
}

export default async function AssignmentsListPage({ params }: PageProps) {
  const { courseId } = await params
  const numericCourseId = parseInt(courseId, 10)
  if (!Number.isInteger(numericCourseId)) notFound()

  const supabase = await createClient()
  const userId = await getCurrentUserId()
  if (!userId) redirect('/auth/login')
  await requireCourseAccess(supabase, userId, numericCourseId)

  const t = await getTranslations('studentCourseWork')
  const format = await getFormatter()

  const [{ data: course }, { data: assignments }] = await Promise.all([
    supabase.from('courses').select('title').eq('course_id', numericCourseId).maybeSingle(),
    supabase
      .from('assignments')
      .select('assignment_id, title, due_at')
      .eq('course_id', numericCourseId)
      .eq('published', true)
      .order('due_at', { ascending: true, nullsFirst: false }),
  ])

  if (!course) notFound()

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <BreadcrumbComponent
        links={[
          { href: '/dashboard/student', label: t('nav.course') },
          { href: `/dashboard/student/courses/${courseId}`, label: course.title },
          { href: '#', label: t('nav.assignments') },
        ]}
      />
      <CourseWorkNav courseId={courseId} current="assignments" />
      <h1 className="text-2xl font-bold tracking-tight">{t('nav.assignments')}</h1>
      {assignments && assignments.length > 0 ? (
        <ul className="grid gap-3">
          {assignments.map((assignment) => (
            <li key={assignment.assignment_id}>
              <Link
                href={`/dashboard/student/courses/${courseId}/assignments/${assignment.assignment_id}`}
                className="block rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <p className="font-semibold">{assignment.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {assignment.due_at
                    ? t('due', { date: format.dateTime(new Date(assignment.due_at), { dateStyle: 'medium', timeStyle: 'short' }) })
                    : t('noDue')}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">{t('noAssignments')}</p>
      )}
    </div>
  )
}
