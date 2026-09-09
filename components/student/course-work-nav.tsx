import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { cn } from '@/lib/utils'

export type CourseWorkNavCurrent = 'course' | 'assignments' | 'grades' | 'calendar'

export async function CourseWorkNav({
  courseId,
  current,
}: {
  courseId: string
  current: CourseWorkNavCurrent
}) {
  const t = await getTranslations('studentCourseWork.nav')
  const links: { id: CourseWorkNavCurrent; href: string; label: string }[] = [
    { id: 'course', href: `/dashboard/student/courses/${courseId}`, label: t('course') },
    {
      id: 'assignments',
      href: `/dashboard/student/courses/${courseId}/assignments`,
      label: t('assignments'),
    },
    {
      id: 'grades',
      href: `/dashboard/student/courses/${courseId}/grades`,
      label: t('grades'),
    },
    {
      id: 'calendar',
      href: `/dashboard/student/courses/${courseId}/calendar`,
      label: t('calendar'),
    },
  ]

  return (
    <nav aria-label={t('label')} className="flex flex-wrap gap-2">
      {links.map((link) => {
        const active = link.id === current
        return (
          <Link
            key={link.id}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-transparent bg-muted/50 text-muted-foreground hover:text-foreground',
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
