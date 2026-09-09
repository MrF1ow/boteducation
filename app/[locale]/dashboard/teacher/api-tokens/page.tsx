import { getUserRole } from '@/lib/supabase/get-user-role'
import { getCurrentTenant } from '@/lib/supabase/tenant'
import { redirect } from 'next/navigation'
import { listMcpTokens, listTokenScopeCourses } from '@/app/actions/mcp-tokens'
import ApiTokensPage from '@/components/dashboard/api-tokens-page'
import { mcpEndpointUrl } from '@/lib/mcp/token-create'

export default async function TeacherApiTokensPage() {
  const role = await getUserRole()
  if (role !== 'teacher') {
    redirect('/dashboard/teacher')
  }

  const [{ data: tokens }, { data: courses }] = await Promise.all([
    listMcpTokens(),
    listTokenScopeCourses(),
  ])
  const tenant = await getCurrentTenant()
  const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'localhost:3000'
  const mcpUrl = mcpEndpointUrl(tenant?.slug, platformDomain)

  return (
    <div className="p-6 lg:p-8">
      <ApiTokensPage tokens={tokens ?? []} mcpUrl={mcpUrl} courses={courses} />
    </div>
  )
}
