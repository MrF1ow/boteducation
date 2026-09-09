'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/supabase/get-user-role'
import { revalidatePath } from 'next/cache'
import { randomBytes, createHash } from 'crypto'
import { getCurrentTenantId, getCurrentUserId } from '@/lib/supabase/tenant'
import { ANALYTICS_EVENTS } from '@/lib/analytics/events'
import { track, safeAnalytics } from '@/lib/analytics/server'
import {
  mcpTokenCreatedAnalytics,
  mcpTokenInsertRow,
  sanitizeCourseIds,
  type TokenRole,
} from '@/lib/mcp/token-create'

export interface McpToken {
  id: number
  name: string
  created_at: string
  last_used_at: string | null
  expires_at: string | null
  is_active: boolean
  course_ids: number[] | null
  token_role: TokenRole
}

export interface TokenScopeCourse {
  course_id: number
  title: string
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function revalidateTokenPages() {
  revalidatePath('/dashboard/admin/api-tokens')
  revalidatePath('/dashboard/teacher/api-tokens')
}

export async function listTokenScopeCourses(): Promise<{
  data: TokenScopeCourse[]
  error: string | null
}> {
  const role = await getUserRole()
  if (role !== 'teacher' && role !== 'admin') {
    return { data: [], error: 'Unauthorized' }
  }

  const supabase = await createClient()
  const tenantId = await getCurrentTenantId()
  const { data, error } = await supabase
    .from('courses')
    .select('course_id, title')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('title')

  if (error) return { data: [], error: error.message }
  return { data: data ?? [], error: null }
}

export async function createMcpToken(
  name: string,
  expiresInDays?: number,
  options?: { courseIds?: number[] },
) {
  const role = await getUserRole()
  if (role !== 'teacher' && role !== 'admin') {
    throw new Error('Only teachers and admins can create API tokens')
  }

  const supabase = await createClient()
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('Not authenticated')

  const courseIds = sanitizeCourseIds(options?.courseIds)
  if (courseIds.length > 0) {
    const tenantId = await getCurrentTenantId()
    const { data: accessible, error: courseError } = await supabase
      .from('courses')
      .select('course_id')
      .eq('tenant_id', tenantId)
      .in('course_id', courseIds)
    if (courseError) throw new Error(courseError.message)
    const ok = new Set((accessible ?? []).map((row) => row.course_id))
    if (courseIds.some((id) => !ok.has(id))) {
      throw new Error('One or more courses are not accessible')
    }
  }

  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = hashToken(rawToken)

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null

  const { error } = await supabase.from('mcp_api_tokens').insert(
    mcpTokenInsertRow({
      userId,
      tokenHash,
      name,
      expiresAt,
      courseIds: courseIds.length > 0 ? courseIds : null,
      tokenRole: 'professor',
    }),
  )

  if (error) throw new Error(error.message)

  await safeAnalytics(async () => {
    await track(
      ANALYTICS_EVENTS.MCP_TOKEN_CREATED,
      mcpTokenCreatedAnalytics(expiresAt, expiresInDays),
      { userId, tenantId: await getCurrentTenantId(), role },
    )
  }, 'mcp_token_created')

  revalidateTokenPages()

  return { token: rawToken }
}

export async function listMcpTokens(): Promise<{ data: McpToken[] | null; error: string | null }> {
  const role = await getUserRole()
  if (role !== 'teacher' && role !== 'admin') {
    return { data: null, error: 'Unauthorized' }
  }

  const supabase = await createClient()
  const userId = await getCurrentUserId()
  if (!userId) return { data: null, error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('mcp_api_tokens')
    .select('id, name, created_at, last_used_at, expires_at, is_active, course_ids, token_role')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return { data: null, error: error.message }
  return { data: data as McpToken[] | null, error: null }
}

export async function revokeMcpToken(tokenId: number) {
  const role = await getUserRole()
  if (role !== 'teacher' && role !== 'admin') {
    throw new Error('Unauthorized')
  }

  const supabase = await createClient()
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('Not authenticated')

  const { data: updated, error } = await supabase
    .from('mcp_api_tokens')
    .update({ is_active: false })
    .eq('id', tokenId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!updated) throw new Error('Token not found')

  revalidateTokenPages()
}

export async function deleteMcpToken(tokenId: number) {
  const role = await getUserRole()
  if (role !== 'teacher' && role !== 'admin') {
    throw new Error('Unauthorized')
  }

  const supabase = await createClient()
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('Not authenticated')

  const { data: deleted, error } = await supabase
    .from('mcp_api_tokens')
    .delete()
    .eq('id', tokenId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!deleted) throw new Error('Token not found')

  revalidateTokenPages()
}
