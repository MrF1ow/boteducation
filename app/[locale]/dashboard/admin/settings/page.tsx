import { getUserRole } from '@/lib/supabase/get-user-role'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { AdminBreadcrumb } from '@/components/admin/admin-breadcrumb'
import { getAllSettingsByCategory } from '@/app/actions/admin/settings'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import GeneralSettingsForm from '@/components/admin/general-settings-form'
import EmailSettingsForm from '@/components/admin/email-settings-form'
import { getCurrentUserId } from '@/lib/supabase/tenant'
import EnrollmentSettingsForm from '@/components/admin/enrollment-settings-form'
import { AutoPublishGradesToggle } from '@/components/admin/auto-publish-grades-toggle'
import { ToursToggle } from '@/components/shared/tours-toggle'
import { getUiState } from '@/lib/supabase/ui-state'
import { areToursEnabled } from '@/lib/ui-state-keys'
import { getMailerStatus } from '@/lib/email/status'
import { MailerStatusRow } from '@/components/admin/mailer-status-row'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const t = await getTranslations('dashboard.admin.settings')
  const tBreadcrumbs = await getTranslations('dashboard.admin.breadcrumbs')
  // Verify admin role
  const role = await getUserRole()
  if (role !== 'admin') {
    redirect('/dashboard/admin')
  }

  // Fetch all settings grouped by category
  const result = await getAllSettingsByCategory()

  if (!result.success || !result.data) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('errorTitle')}</CardTitle>
            <CardDescription>
              {result.error || t('errorDesc')}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const settings = result.data
  const mailer = getMailerStatus()

  const { tab } = await searchParams
  const validTabs = ['general', 'email', 'enrollment']
  const defaultTab = tab && validTabs.includes(tab) ? tab : 'general'

  const userId = await getCurrentUserId()
  const uiState = userId ? await getUiState(userId) : {}

  return (
    <div className="min-h-screen bg-background" data-testid="settings-page">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto container px-4 py-5 sm:px-6 lg:px-8">
          <div className="mb-4">
            <AdminBreadcrumb
              items={[
                { label: tBreadcrumbs('admin'), href: '/dashboard/admin' },
                { label: tBreadcrumbs('settings') },
              ]}
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t('description')}</p>
        </div>
      </header>

      <main className="mx-auto container px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('sections.grading.title')}</CardTitle>
              <CardDescription>
                {t('sections.grading.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AutoPublishGradesToggle
                enabled={settings.general?.auto_publish_grades?.value?.enabled === true}
              />
            </CardContent>
          </Card>

          <Tabs defaultValue={defaultTab} className="space-y-6">
            <TabsList className="flex w-full overflow-x-auto lg:w-auto">
              <TabsTrigger value="general">{t('tabs.general')}</TabsTrigger>
              <TabsTrigger value="email">{t('tabs.email')}</TabsTrigger>
              <TabsTrigger value="enrollment">{t('tabs.enrollment')}</TabsTrigger>
            </TabsList>

            {/* General Settings */}
            <TabsContent value="general">
              <Card>
                <CardHeader>
                  <CardTitle>{t('sections.general.title')}</CardTitle>
                  <CardDescription>
                    {t('sections.general.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <GeneralSettingsForm settings={settings.general || {}} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Email Settings */}
            <TabsContent value="email">
              <Card>
                <CardHeader>
                  <CardTitle>{t('sections.email.title')}</CardTitle>
                  <CardDescription>
                    {t('sections.email.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <MailerStatusRow status={mailer} />
                  <EmailSettingsForm settings={settings.email || {}} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Enrollment Settings */}
            <TabsContent value="enrollment">
              <Card>
                <CardHeader>
                  <CardTitle>{t('sections.enrollment.title')}</CardTitle>
                  <CardDescription>
                    {t('sections.enrollment.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EnrollmentSettingsForm settings={settings.enrollment || {}} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Personal preferences — per-user, kept visually separate from the
              tenant-wide settings tabs above (#452). */}
          <Card>
            <CardHeader>
              <CardTitle>{t('sections.personalPreferences.title')}</CardTitle>
              <CardDescription>
                {t('sections.personalPreferences.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ToursToggle initialEnabled={areToursEnabled(uiState)} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
