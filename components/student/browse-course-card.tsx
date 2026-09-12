'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { IconCheck, IconTrophy } from '@tabler/icons-react'
import { useEnrollment } from '@/lib/hooks/use-enrollment'

export type EnrollmentStatus =
  | { variant: 'enrolled' }
  | { variant: 'enrollable' }

interface BrowseCourseCardProps {
  course: {
    course_id: number
    title: string
    description?: string | null
    thumbnail_url?: string | null
    tags?: string | string[] | null
  }
  enrollmentStatus: EnrollmentStatus
}

export function BrowseCourseCard({
  course,
  enrollmentStatus,
}: BrowseCourseCardProps) {
  const { enrollInCourse, loading } = useEnrollment()
  const t = useTranslations('components.browseCourse')

  const isEnrolled = enrollmentStatus.variant === 'enrolled'

  const handleEnroll = async () => {
    if (enrollmentStatus.variant !== 'enrollable') return
    await enrollInCourse(course.course_id)
  }

  const tags = course.tags
    ? (Array.isArray(course.tags) ? course.tags : course.tags.split(',')).slice(0, 3)
    : []

  const courseHref = `/dashboard/student/courses/${course.course_id}`

  const media = (
    <div className="relative aspect-video w-full overflow-hidden bg-muted">
      {course.thumbnail_url ? (
        <img
          src={course.thumbnail_url}
          alt={course.title}
          className="object-cover w-full h-full hover:scale-105 transition-transform duration-300"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
          <IconTrophy className="w-12 h-12 text-muted-foreground" />
        </div>
      )}

      {isEnrolled && (
        <div className="absolute top-3 right-3">
          <Badge className="gap-1 bg-green-500 hover:bg-green-600">
            <IconCheck className="w-3 h-3" />
            {t('enrolled')}
          </Badge>
        </div>
      )}
    </div>
  )

  return (
    <Card className="flex flex-col overflow-hidden hover:shadow-lg transition-shadow" data-testid={`browse-course-${course.course_id}`}>
      {isEnrolled ? <Link href={courseHref}>{media}</Link> : media}

      <CardHeader className="pb-3">
        {isEnrolled ? (
          <Link href={courseHref}>
            <h3 className="font-semibold text-lg line-clamp-2 hover:text-primary transition-colors">
              {course.title}
            </h3>
          </Link>
        ) : (
          <h3 className="font-semibold text-lg line-clamp-2">
            {course.title}
          </h3>
        )}
      </CardHeader>

      <CardContent className="flex-1 pb-3 space-y-3">
        {course.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {course.description}
          </p>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag.trim()}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-3 border-t">
        <BrowseCardAction
          variant={enrollmentStatus.variant}
          courseId={course.course_id}
          onEnroll={handleEnroll}
          loading={loading}
          t={t}
        />
      </CardFooter>
    </Card>
  )
}

function BrowseCardAction({
  variant,
  courseId,
  onEnroll,
  loading,
  t,
}: {
  variant: EnrollmentStatus['variant']
  courseId: number
  onEnroll: () => void
  loading: boolean
  t: ReturnType<typeof useTranslations>
}) {
  switch (variant) {
    case 'enrolled':
      return (
        <Link href={`/dashboard/student/courses/${courseId}`} className="w-full">
          <Button className="w-full" data-testid="browse-continue">{t('goCourse')}</Button>
        </Link>
      )
    case 'enrollable':
      return (
        <Button
          className="w-full"
          onClick={onEnroll}
          disabled={loading}
          data-testid="browse-enroll"
        >
          {loading ? t('enrolling') : t('enrollNow')}
        </Button>
      )
  }
}
