import { createAdminClient } from '@/lib/supabase/admin'
import { mintUserAccessToken } from '@/lib/mcp/mint-user-access-token'

export type PatProxyHeaders = Record<string, string>

export type ValidatedPat = {
  userId: string
  userRole: string
  tokenId: number
  courseIds: number[] | null
}

export function parseValidatedPatRow(row: {
  user_id: string
  user_role: string
  token_id: number
  course_ids: number[] | null
}): ValidatedPat {
  const courseIds =
    Array.isArray(row.course_ids) && row.course_ids.length > 0
      ? row.course_ids.filter((n) => Number.isInteger(n))
      : null
  return {
    userId: row.user_id,
    userRole: row.user_role,
    tokenId: row.token_id,
    courseIds: courseIds && courseIds.length > 0 ? courseIds : null,
  }
}

export function patProxyHeaders(accessToken: string, courseIds: number[] | null): PatProxyHeaders {
  const headers: PatProxyHeaders = {
    authorization: `Bearer ${accessToken}`,
    'x-mcp-course-ids': courseIds ? courseIds.join(',') : '',
  }
  return headers
}

export async function resolvePatProxyHeaders(
  bearerToken: string,
): Promise<
  | { ok: true; headers: PatProxyHeaders; pat: ValidatedPat }
  | { ok: false; status: 401 | 403; message: string }
> {
  const admin = createAdminClient()
  const { data: tokenData, error } = await admin.rpc('validate_mcp_api_token', {
    token_input: bearerToken,
  })

  if (error || !tokenData || tokenData.length === 0) {
    return {
      ok: false,
      status: 401,
      message: 'Unauthorized: Invalid, expired, or revoked API token',
    }
  }

  const pat = parseValidatedPatRow(tokenData[0])
  if (pat.userRole !== 'teacher' && pat.userRole !== 'admin') {
    return {
      ok: false,
      status: 403,
      message: `Forbidden: MCP requires teacher or admin role (current: ${pat.userRole})`,
    }
  }

  const accessToken = await mintUserAccessToken(pat.userId, pat.courseIds)
  return { ok: true, headers: patProxyHeaders(accessToken, pat.courseIds), pat }
}
