import { getUserRole } from '@/lib/supabase/get-user-role'
import { getCurrentTenant } from '@/lib/supabase/tenant'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { listMcpTokens, listTokenScopeCourses } from '@/app/actions/mcp-tokens'
import { AdminBreadcrumb } from '@/components/admin/admin-breadcrumb'
import ApiTokensPage from '@/components/dashboard/api-tokens-page'
import { mcpEndpointUrl } from '@/lib/mcp/token-create'

export default async function AdminApiTokensPage() {
  const role = await getUserRole()
  if (role !== 'admin') {
    redirect('/dashboard/admin')
  }

  const tBreadcrumbs = await getTranslations('dashboard.admin.breadcrumbs')
  const [{ data: tokens }, { data: courses }] = await Promise.all([
    listMcpTokens(),
    listTokenScopeCourses(),
  ])
  const tenant = await getCurrentTenant()
  const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'localhost:3000'
  const mcpUrl = mcpEndpointUrl(tenant?.slug, platformDomain)

  return (
    <div className="min-h-screen bg-background" data-testid="api-tokens-page">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto container px-4 py-5 sm:px-6 lg:px-8">
          <AdminBreadcrumb
            items={[
              { label: tBreadcrumbs('admin'), href: '/dashboard/admin' },
              { label: tBreadcrumbs('apiTokens') },
            ]}
          />
        </div>
      </header>

      <main className="mx-auto container px-4 py-6 sm:px-6 lg:px-8">
        <ApiTokensPage tokens={tokens ?? []} mcpUrl={mcpUrl} courses={courses} />
      </main>
    </div>
  )
}
