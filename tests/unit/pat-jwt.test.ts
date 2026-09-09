import { describe, expect, it } from 'vitest'
import {
  attachCourseIdsClaim,
  decodeJwtPayload,
  isJwt,
  jwtAlg,
  parseCourseIdsClaim,
  signHs256Jwt,
} from '@/lib/mcp/pat-jwt'

describe('pat-jwt', () => {
  it('detects JWTs vs hex PATs', () => {
    expect(isJwt('aaaa.bbbb.cccc')).toBe(true)
    expect(isJwt('aabbccddeeff')).toBe(false)
  })

  it('round-trips course_ids onto an HS256 token', () => {
    const secret = 'test-secret-at-least-32-characters-long'
    const base = signHs256Jwt(
      { sub: 'user-1', tenant_id: 't1', tenant_role: 'teacher', role: 'authenticated' },
      secret,
    )
    const withCourses = attachCourseIdsClaim(base, [4, 7], secret)
    const payload = decodeJwtPayload(withCourses)
    expect(payload).not.toBeNull()
    expect(parseCourseIdsClaim(payload!)).toEqual([4, 7])
  })

  it('leaves the token unchanged when there is no signing secret', () => {
    const token = 'aaaa.bbbb.cccc'
    expect(attachCourseIdsClaim(token, [1], undefined)).toBe(token)
  })

  it('leaves ES256 tokens unchanged so JWKS verification still works', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString(
      'base64url',
    )
    const body = Buffer.from(JSON.stringify({ sub: 'user-1' })).toString('base64url')
    const token = `${header}.${body}.sig`
    expect(jwtAlg(token)).toBe('ES256')
    expect(attachCourseIdsClaim(token, [1], 'a-secret-that-is-long-enough')).toBe(token)
  })
})
