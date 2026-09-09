export type TokenRole = 'professor' | 'admin'

export function sanitizeCourseIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  const ids = raw.flatMap((value) => {
    const n = typeof value === 'number' ? value : Number(value)
    return Number.isInteger(n) && n > 0 ? [n] : []
  })
  return [...new Set(ids)]
}

export function mcpTokenInsertRow(args: {
  userId: string
  tokenHash: string
  name: string
  expiresAt: string | null
  courseIds: number[] | null
  tokenRole: TokenRole
}) {
  return {
    user_id: args.userId,
    token_hash: args.tokenHash,
    name: args.name,
    expires_at: args.expiresAt,
    is_active: true,
    course_ids: args.courseIds,
    token_role: args.tokenRole,
  }
}

export function mcpTokenCreatedAnalytics(
  expiresAt: string | null,
  expiresInDays?: number,
) {
  return {
    has_expiry: expiresAt !== null,
    expires_in_days: expiresInDays ?? null,
  }
}

export function mcpEndpointUrl(
  slug: string | null | undefined,
  platformDomain: string,
): string {
  const domain = platformDomain || 'localhost:3000'
  return slug
    ? `https://${slug}.${domain}/api/mcp`
    : `https://${domain}/api/mcp`
}

export function professorPasteBlock(mcpUrl: string, token: string): string {
  return `MCP URL\n${mcpUrl}\nAuthorization\nBearer ${token}`
}
