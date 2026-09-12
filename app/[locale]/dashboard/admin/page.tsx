import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentTenantId, getCurrentUserId } from '@/lib/supabase/tenant'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { format } from 'date-fns'
import { es, enUS } from 'date-fns/locale'
import {
  IconUsers,
  IconBook,
  IconArrowUpRight,
  IconUserPlus,
} from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminBreadcrumb } from '@/components/admin/admin-breadcrumb'
import { OnboardingChecklist } from '@/components/shared/onboarding-checklist'
import { AdminDashboardTour } from '@/components/tours/admin-dashboard-tour'
import { getUiState } from '@/lib/supabase/ui-state'
import { isTourCompleted, areToursEnabled, isChecklistDismissed, checklistStateKey } from '@/lib/ui-state-keys'
import { getSchoolJoinUrl } from '@/app/actions/admin/invitations'

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations('dashboard.admin.main')
  const tBreadcrumbs = await getTranslations('dashboard.admin.breadcrumbs')
  const dateLocale = locale === 'es' ? es : enUS
  const supabase = createAdminClient()

  const userId = await getCurrentUserId()
  if (!userId) {
    redirect('/auth/login')
  }

  // Get tenant context for all queries
  const tenantId = await getCurrentTenantId()

  // Get platform statistics — ALL queries scoped to current tenant
  const [
    { count: totalUsers },
    { count: totalCourses },
    { count: publishedCourses },
    { data: firstCourseRows },
    { data: readyCourseRows },
    { count: publishedLessons },
    { data: recentTenantUsers },
    uiState,
  ] = await Promise.all([
    supabase.from('tenant_users').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'active'),
    supabase.from('courses').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase
      .from('courses')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'published'),
    // The oldest course with its lesson count: where the "first course" step
    // sends the owner next (quick create, or that course's lesson editor).
    supabase
      .from('courses')
      .select('course_id, title, status, lessons(id)')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1),
    // The first course a student can actually open: published, with at least
    // one published lesson (#675). This is what completes the step and what
    // the milestone card links to.
    supabase
      .from('courses')
      .select('course_id, title, lessons!inner(id)')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .eq('status', 'published')
      .eq('lessons.status', 'published')
      .order('created_at', { ascending: true })
      .limit(1),
    // Any published lesson at all — the second sub-step. A creator who
    // publishes the lesson before the course still sees that half ticked.
    supabase
      .from('lessons')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'published'),
    supabase
      .from('tenant_users')
      .select('user_id, created_at, profiles(id, full_name)')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5),
    getUiState(userId),
  ])

  // Supabase infers the profiles(...) embed as an array even though the FK
  // makes it a single row — narrow it to what the query actually returns.
  const recentUsers = (recentTenantUsers || []) as unknown as Array<{
    user_id: string
    created_at: string
    profiles: { id: string; full_name: string | null } | null
  }>

  const [
    { data: onboardingSettings },
  ] = await Promise.all([
    supabase.from('tenant_settings').select('setting_key, setting_value')
      .eq('tenant_id', tenantId)
      .in('setting_key', ['site_name', 'theme_preset', 'logo_url']),
  ])

  const settingsByKey = new Map(
    (onboardingSettings || []).map(s => [s.setting_key, s.setting_value])
  )
  const currentSettings = { site_name: settingsByKey.get('site_name') }
  const hasBranding = settingsByKey.has('theme_preset') || settingsByKey.has('logo_url')
  const firstCourse = firstCourseRows?.[0]
  const firstCourseLessonCount = firstCourse?.lessons?.length ?? 0
  const firstReadyCourse = readyCourseRows?.[0]
  const hasPublishedCourse = (publishedCourses || 0) > 0
  const hasPublishedLesson = (publishedLessons || 0) > 0
  const hasOpenableCourse = Boolean(firstReadyCourse)
  // Where "Create your first course" points, by state: nothing yet → quick
  // create; a course with no lesson → its lesson editor; otherwise the course.
  const firstCourseHref = !firstCourse
    ? '/dashboard/admin/courses/new'
    : firstCourseLessonCount === 0
      ? `/dashboard/teacher/courses/${firstCourse.course_id}/lessons/new?from=new-course`
      : `/dashboard/teacher/courses/${firstCourse.course_id}`
  const joinUrl = await getSchoolJoinUrl()

  const stats = [
    {
      title: t('stats.totalUsers'),
      value: totalUsers || 0,
      icon: IconUsers,
      link: '/dashboard/admin/users',
    },
    {
      title: t('stats.totalCourses'),
      value: totalCourses || 0,
      subtitle: t('stats.published', { count: publishedCourses || 0 }),
      icon: IconBook,
      link: '/dashboard/admin/courses',
    },
  ]

  return (
    <div className="space-y-6 p-6 lg:p-8" data-testid="admin-dashboard">
      <AdminBreadcrumb
        items={[
          { label: tBreadcrumbs('admin') },
        ]}
      />

      {/* Guided Tour (client component) */}
      <AdminDashboardTour
        userId={userId}
        completed={isTourCompleted(uiState, 'admin-dashboard')}
        toursEnabled={areToursEnabled(uiState)}
      />

      {/* Getting Started Checklist — prominent for new users */}
      <div data-tour="admin-checklist">
      <OnboardingChecklist
        storageKey={`admin-${userId}`}
        stateKey={checklistStateKey('admin')}
        dismissed={isChecklistDismissed(uiState, 'admin')}
        title={t('onboarding.title')}
        subtitle={t('onboarding.subtitle')}
        milestone={firstReadyCourse ? {
          stepId: 'add-course',
          title: t('onboarding.courseSuccessTitle'),
          description: t('onboarding.courseSuccessDescription', {
            course: firstReadyCourse.title,
          }),
          href: `/courses/${firstReadyCourse.course_id}`,
          copyLabel: t('onboarding.copyCourseLink'),
          copiedLabel: t('onboarding.courseLinkCopied'),
          viewLabel: t('onboarding.viewCourse'),
        } : undefined}
        steps={[
          {
            id: 'add-course',
            label: t('onboarding.addCourse'),
            description: t('onboarding.addCourseDesc'),
            href: firstCourseHref,
            // A course counts once a student can open something in it: the
            // course is published AND has a published lesson (#675).
            completed: hasOpenableCourse,
            timeHint: t('onboarding.addCourseTime'),
            substeps: [
              {
                id: 'publish-course',
                label: t('onboarding.addCourseStepPublish'),
                completed: hasPublishedCourse,
              },
              {
                id: 'publish-lesson',
                label: t('onboarding.addCourseStepLesson'),
                completed: hasPublishedLesson,
              },
            ],
          },
          {
            // Right after the course: a live course with nobody in it is the
            // state the prod sandbox got stuck in (#675). Payments and
            // branding are optional; a first student is the point.
            id: 'invite-users',
            label: t('onboarding.inviteUsers'),
            description: t('onboarding.inviteUsersDesc'),
            href: '/dashboard/admin/users',
            completed: (totalUsers || 0) > 1, // More than just the admin
            timeHint: t('onboarding.inviteUsersTime'),
            share: {
              url: joinUrl,
              copyLabel: t('onboarding.copyJoinLink'),
              copiedLabel: t('onboarding.joinLinkCopied'),
              whatsappLabel: t('onboarding.shareWhatsApp'),
              whatsappText: t('onboarding.inviteWhatsAppMessage', { url: joinUrl }),
            },
          },
          {
            id: 'brand-school',
            label: t('onboarding.brandSchool'),
            description: t('onboarding.brandSchoolDesc'),
            href: '/dashboard/admin/appearance',
            completed: hasBranding,
            timeHint: t('onboarding.brandSchoolTime'),
          },
          {
            id: 'configure-school',
            label: t('onboarding.configureSchool'),
            description: t('onboarding.configureSchoolDesc'),
            href: '/dashboard/admin/settings',
            completed: Boolean(currentSettings?.site_name),
            timeHint: t('onboarding.configureSchoolTime'),
          },
        ]}
        footer={
          <p className="text-xs text-muted-foreground">
            {t('onboarding.wizardPrompt')}{' '}
            <Link
              href="/onboarding"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('onboarding.wizardLink')}
            </Link>
          </p>
        }
      />
      </div>

      {/* Stats Grid */}

      {/* Stats Grid — clean, no color noise */}
      <div data-tour="admin-stats" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2" data-testid="admin-stats-grid">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.link} className="group">
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <stat.icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                </div>
                <p className="mt-3 text-2xl font-bold tracking-tight">
                  {stat.value}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {stat.title}
                </p>
                {stat.subtitle && (
                  <p className="text-[11px] text-muted-foreground/60">
                    {stat.subtitle}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

        {/* Recent Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconUserPlus className="h-4 w-4 text-muted-foreground" />
                <span>{t('recentActivity.users')}</span>
              </div>
              <Link href="/dashboard/admin/users">
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
                  {t('recentActivity.viewAll')}
                  <IconArrowUpRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {recentUsers.length > 0 ? (
                recentUsers.map((tu) => (
                  <div
                    key={tu.user_id}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {(tu.profiles?.full_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <p className="text-sm font-medium">{tu.profiles?.full_name || t('recentActivity.unknown')}</p>
                    </div>
                    <p className="text-[11px] tabular-nums text-muted-foreground">
                      {format(new Date(tu.created_at), 'MMM d', { locale: dateLocale })}
                    </p>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <IconUsers className="h-5 w-5 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('recentActivity.noUsers')}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
    </div>
  )
}
