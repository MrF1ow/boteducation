import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getUserRole } from '@/lib/supabase/get-user-role'
import { Button } from '@/components/ui/button'
import { UserGrowthChart } from '@/components/admin/user-growth-chart'
import { EngagementMetrics } from '@/components/admin/engagement-metrics'
import { CoursePopularityChart } from '@/components/admin/course-popularity-chart'
import { ExportButton } from '@/components/admin/export-button'
import Link from 'next/link'
import { AdminBreadcrumb } from '@/components/admin/admin-breadcrumb'
import { getTranslations } from 'next-intl/server'
import { format } from 'date-fns'
import { es, enUS } from 'date-fns/locale'
import {getCurrentTenantId, getCurrentUserId } from '@/lib/supabase/tenant'

type CountEmbed = { count?: number }
type CourseProgressEmbed = {
  course_id: number
  lessons?: CountEmbed[]
}
type EnrollmentProgressRow = {
  user_id: string
  course: CourseProgressEmbed | CourseProgressEmbed[] | null
}
type CoursePopularityRow = {
  course_id: number
  title: string
  enrollments?: CountEmbed[]
  lessons?: Array<{ lesson_id: number }>
}

function asCourse(value: EnrollmentProgressRow['course']): CourseProgressEmbed | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

interface SearchParams {
  period?: string
}

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<SearchParams>
}) {
  const { locale } = await params
  const resolvedSearchParams = await searchParams
  const t = await getTranslations('dashboard.admin.analytics')
  const tBreadcrumbs = await getTranslations('dashboard.admin.breadcrumbs')
  const dateLocale = locale === 'es' ? es : enUS
  const supabase = createAdminClient()

  const userId = await getCurrentUserId()
  if (!userId) {
    redirect('/auth/login')
  }

  const role = await getUserRole()
  if (role !== 'admin') {
    redirect('/dashboard/student')
  }

  const tenantId = await getCurrentTenantId()

  // Get period from query params (default: 30 days)
  const period = resolvedSearchParams.period || '30'
  const daysAgo = parseInt(period)
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - daysAgo)

  // Active students (users with activity in last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Parallelize all independent data queries
  const [
    { data: tenantUserIds },
    { count: totalUsers },
    { count: totalEnrollments },
    { data: activeStudentIds },
    { count: totalLessonCompletions },
    { count: totalExamSubmissions },
    { data: enrollmentsWithProgress },
    { data: coursesWithEnrollments },
  ] = await Promise.all([
    supabase.from('tenant_users').select('user_id, created_at')
      .eq('tenant_id', tenantId).eq('status', 'active')
      .gte('created_at', startDate.toISOString()).order('created_at', { ascending: true }),
    supabase.from('tenant_users').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'active'),
    supabase.from('enrollments').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    supabase.from('lesson_completions').select('user_id')
      .eq('tenant_id', tenantId).gte('completed_at', thirtyDaysAgo.toISOString()),
    supabase.from('lesson_completions').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    supabase.from('exam_submissions').select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    supabase.from('enrollments').select(`
      enrollment_id,
      user_id,
      course:courses (
        course_id,
        lessons:lessons (count)
      )
    `).eq('tenant_id', tenantId),
    supabase.from('courses').select(`
      course_id,
      title,
      enrollments:enrollments (count),
      lessons:lessons (
        lesson_id
      )
    `).eq('tenant_id', tenantId).eq('status', 'published'),
  ])

  // Calculate user growth data
  const profiles = tenantUserIds?.map((tu) => ({ created_at: tu.created_at })) || []

  const usersByDate = new Map<string, number>()
  let runningTotal = (totalUsers || 0) - (profiles?.length || 0)

  profiles?.forEach((p) => {
    const date = format(new Date(p.created_at), 'MMM d', { locale: dateLocale })
    const existing = usersByDate.get(date) || 0
    usersByDate.set(date, existing + 1)
  })

  const userGrowthData = Array.from(usersByDate.entries()).map(([date, newUsers]) => {
    runningTotal += newUsers
    return {
      date,
      newUsers,
      totalUsers: runningTotal,
    }
  })

  const activeStudents = new Set(activeStudentIds?.map((s) => s.user_id)).size

  // Calculate average completion rate
  let totalCompletionRate = 0
  let validEnrollments = 0

  if (enrollmentsWithProgress) {
    for (const enrollment of enrollmentsWithProgress as EnrollmentProgressRow[]) {
      const course = asCourse(enrollment.course)
      if (!course?.lessons?.[0]?.count) continue

      const totalLessons = course.lessons[0].count
      if (totalLessons === 0) continue

      const { count: completedLessons } = await supabase
        .from('lesson_completions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', enrollment.user_id)
        .in(
          'lesson_id',
          (
            await supabase
              .from('lessons')
              .select('lesson_id')
              .eq('course_id', course.course_id)
          ).data?.map((l) => l.lesson_id) || []
        )

      const completionRate = (completedLessons || 0) / totalLessons
      totalCompletionRate += completionRate
      validEnrollments++
    }
  }

  const averageCompletionRate =
    validEnrollments > 0 ? (totalCompletionRate / validEnrollments) * 100 : 0

  const coursePopularityData = await Promise.all(
    (coursesWithEnrollments as CoursePopularityRow[] | null || []).map(async (course) => {
      const enrollmentCount = course.enrollments?.[0]?.count || 0
      const lessonIds = course.lessons?.map((l) => l.lesson_id) || []

      if (lessonIds.length === 0) {
        return {
          courseId: course.course_id,
          title: course.title,
          enrollments: enrollmentCount,
          completionRate: 0,
        }
      }

      // Get enrollments for this course
      const { data: courseEnrollments } = await supabase
        .from('enrollments')
        .select('user_id')
        .eq('course_id', course.course_id)

      if (!courseEnrollments || courseEnrollments.length === 0) {
        return {
          courseId: course.course_id,
          title: course.title,
          enrollments: 0,
          completionRate: 0,
        }
      }

      // Calculate completion rate for this course
      let totalCompletions = 0
      for (const enrollment of courseEnrollments) {
        const { count: completedCount } = await supabase
          .from('lesson_completions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', enrollment.user_id)
          .in('lesson_id', lessonIds)

        totalCompletions += (completedCount || 0) / lessonIds.length
      }

      const completionRate =
        courseEnrollments.length > 0
          ? (totalCompletions / courseEnrollments.length) * 100
          : 0

      return {
        courseId: course.course_id,
        title: course.title,
        enrollments: enrollmentCount,
        completionRate,
      }
    })
  )

  coursePopularityData.sort((a, b) => b.enrollments - a.enrollments)

  const periodKeys: Record<string, string> = { '7': 'last7days', '30': 'last30days', '90': 'last90days', '365': 'lastYear' }
  const periodLabel = t(`periodLabels.${periodKeys[period] || 'generic'}`, { days: period })

  return (
    <div className="space-y-6 p-6 lg:p-8" data-testid="analytics-page">
      <AdminBreadcrumb
        items={[
          { label: tBreadcrumbs('admin'), href: '/dashboard/admin' },
          { label: tBreadcrumbs('analytics') },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={{
              userGrowthData,
              coursePopularityData,
              metrics: {
                totalUsers: totalUsers || 0,
                totalEnrollments: totalEnrollments || 0,
                activeStudents,
                averageCompletionRate,
              },
            }}
            period={period}
          />
          <div className="flex gap-1">
            {(['7', '30', '90', '365'] as const).map((p) => (
              <Link key={p} href={`?period=${p}`}>
                <Button variant={period === p ? 'default' : 'outline'} size="sm" className="text-xs">
                  {t(`periods.${p === '365' ? '1year' : `${p}days`}`)}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <UserGrowthChart
        data={userGrowthData}
        totalUsers={totalUsers || 0}
        period={periodLabel}
      />

      <EngagementMetrics
        totalEnrollments={totalEnrollments || 0}
        activeStudents={activeStudents}
        averageCompletionRate={averageCompletionRate}
        totalLessonCompletions={totalLessonCompletions || 0}
        totalExamSubmissions={totalExamSubmissions || 0}
      />

      <CoursePopularityChart data={coursePopularityData} />
    </div>
  )
}
