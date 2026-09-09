import { createHmac } from 'node:crypto'

export function isJwt(token: string): boolean {
  const parts = token.split('.')
  return parts.length === 3 && parts.every((p) => p.length > 0)
}

export function decodeJwtPayload(
  token: string,
): Record<string, unknown> | null {
  if (!isJwt(token)) return null
  const payload = token.split('.')[1]
  try {
    const json = Buffer.from(payload, 'base64url').toString('utf8')
    const parsed: unknown = JSON.parse(json)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

export function signHs256Jwt(
  payload: Record<string, unknown>,
  secret: string,
): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url')
  return `${header}.${body}.${sig}`
}

export function jwtAlg(token: string): string | null {
  if (!isJwt(token)) return null
  try {
    const json = Buffer.from(token.split('.')[0], 'base64url').toString('utf8')
    const parsed: unknown = JSON.parse(json)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    const alg = (parsed as { alg?: unknown }).alg
    return typeof alg === 'string' ? alg : null
  } catch {
    return null
  }
}

/**
 * Re-sign only HS256 tokens. Cloud ES256/JWKS tokens must keep their original
 * signature; course scope rides on `X-Mcp-Course-Ids` for those.
 */
export function attachCourseIdsClaim(
  accessToken: string,
  courseIds: number[] | null,
  jwtSecret: string | undefined,
): string {
  if (courseIds === null || courseIds.length === 0) return accessToken
  if (!jwtSecret) return accessToken
  if (jwtAlg(accessToken) !== 'HS256') return accessToken
  const payload = decodeJwtPayload(accessToken)
  if (!payload) return accessToken
  return signHs256Jwt({ ...payload, course_ids: courseIds }, jwtSecret)
}

export function parseCourseIdsClaim(payload: Record<string, unknown>): number[] | null {
  const raw = payload.course_ids
  if (!Array.isArray(raw)) return null
  const ids = raw.filter((n): n is number => typeof n === 'number' && Number.isInteger(n))
  return ids.length > 0 ? ids : null
}
