import { createClient } from '@/lib/supabase/server'
import { getCurrentUserId } from '@/lib/supabase/tenant'
import { requireCourseAccess } from '@/lib/services/course-access-guard'
import { redirect, notFound } from 'next/navigation'
import { getFormatter, getTranslations } from 'next-intl/server'
import { CourseWorkNav } from '@/components/student/course-work-nav'
import BreadcrumbComponent from '@/components/exercises/breadcrumb-component'

interface PageProps {
  params: Promise<{ courseId: string }>
}

export default async function CourseCalendarPage({ params }: PageProps) {
  const { courseId } = await params
  const numericCourseId = parseInt(courseId, 10)
  if (!Number.isInteger(numericCourseId)) notFound()

  const supabase = await createClient()
  const userId = await getCurrentUserId()
  if (!userId) redirect('/auth/login')
  await requireCourseAccess(supabase, userId, numericCourseId)

  const t = await getTranslations('studentCourseWork')
  const format = await getFormatter()

  const [{ data: course }, { data: items }] = await Promise.all([
    supabase.from('courses').select('title').eq('course_id', numericCourseId).maybeSingle(),
    supabase
      .from('course_calendar_items')
      .select('item_id, item_kind, title, due_at')
      .eq('course_id', numericCourseId)
      .not('due_at', 'is', null)
      .order('due_at', { ascending: true }),
  ])

  if (!course) notFound()

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <BreadcrumbComponent
        links={[
          { href: '/dashboard/student', label: t('nav.course') },
          { href: `/dashboard/student/courses/${courseId}`, label: course.title },
          { href: '#', label: t('nav.calendar') },
        ]}
      />
      <CourseWorkNav courseId={courseId} current="calendar" />
      <h1 className="text-2xl font-bold tracking-tight">{t('nav.calendar')}</h1>
      {items && items.length > 0 ? (
        <ol className="space-y-3">
          {items.map((item) => (
            <li
              key={`${item.item_kind}-${item.item_id}`}
              className="rounded-xl border bg-card p-4"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {item.item_kind === 'exam' ? t('exam') : t('assignment')}
              </p>
              <p className="font-semibold">{item.title}</p>
              {item.due_at ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {format.dateTime(new Date(item.due_at), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted-foreground">{t('emptyCalendar')}</p>
      )}
    </div>
  )
}
