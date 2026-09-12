import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { BrowseCourseCard } from '@/components/student/browse-course-card'
import { CourseSearchBar } from '@/components/shared/course-search-bar'
import { IconSparkles, IconSearch } from '@tabler/icons-react'
import { getCurrentTenantId, getCurrentUserId } from '@/lib/supabase/tenant'
import {
  getPublishedCourses,
  getCourseCategories,
} from '@lms/core'
import { track } from '@/lib/analytics/server'
import { ANALYTICS_EVENTS } from '@/lib/analytics/events'

export default async function BrowseCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; category?: string }>
}) {
  const { search, category } = await searchParams
  const tenantId = await getCurrentTenantId()
  const supabase = createAdminClient()

  const sanitizedSearch = search?.replace(/[%_\\]/g, '') || ''

  const userId = await getCurrentUserId()
  if (!userId) {
    redirect('/auth/login')
  }

  const [{ data: categories }, { data: courses }, { data: enrollments }] = await Promise.all([
    getCourseCategories(supabase, tenantId),
    getPublishedCourses(supabase, tenantId, {
      search: sanitizedSearch || undefined,
      categoryId: category ? Number(category) : undefined,
    }),
    supabase
      .from('enrollments')
      .select('course_id')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),
  ])

  const t = await getTranslations('dashboard.student.browse')
  const tSearch = await getTranslations('courseSearch')

  const enrolledCourseIds = new Set((enrollments ?? []).map((row) => row.course_id))

  const hasActiveFilters = sanitizedSearch || category

  if (hasActiveFilters) {
    const resultCount = courses?.length ?? 0
    await track(
      ANALYTICS_EVENTS.CATALOG_SEARCHED,
      {
        query: sanitizedSearch || null,
        query_length: sanitizedSearch.length,
        has_category_filter: Boolean(category),
        result_count: resultCount,
      },
      { userId, tenantId, role: 'student' }
    )

    if (resultCount === 0) {
      await track(
        ANALYTICS_EVENTS.BROWSE_ZERO_RESULTS,
        { query: sanitizedSearch || null, has_category_filter: Boolean(category) },
        { userId, tenantId, role: 'student' }
      )
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 container" data-testid="browse-courses-page">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <IconSparkles className="w-6 h-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight truncate" data-testid="browse-title">{t('title')}</h1>
        </div>
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      <CourseSearchBar
        categories={categories || []}
        currentSearch={sanitizedSearch}
        currentCategory={category}
      />

      {!courses || courses.length === 0 ? (
        <div className="border rounded-lg p-12 text-center flex flex-col items-center gap-4">
          <div className="p-4 bg-muted/30 rounded-full">
            <IconSearch className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="text-muted-foreground">
            {hasActiveFilters ? tSearch('noResults') : t('noCoursesAvailable')}
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 text-sm text-muted-foreground" data-testid="browse-course-count">
            {t('showingCourses', { count: courses.length })}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => {
              const enrollmentStatus = enrolledCourseIds.has(course.course_id)
                ? { variant: 'enrolled' as const }
                : { variant: 'enrollable' as const }

              return (
                <BrowseCourseCard
                  key={course.course_id}
                  course={course}
                  enrollmentStatus={enrollmentStatus}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
