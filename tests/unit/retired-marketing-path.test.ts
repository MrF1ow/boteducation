import { describe, expect, it } from 'vitest'
import { isRetiredMarketingPath } from '@/lib/auth/retired-marketing-path'

describe('isRetiredMarketingPath', () => {
  it.each(['/', '/create-school', '/creators', '/courses', '/courses/42', '/about', '/p/home'])(
    'treats %s as retired marketing',
    (path) => {
      expect(isRetiredMarketingPath(path)).toBe(true)
    },
  )

  it.each([
    '/auth/login',
    '/auth/sign-up',
    '/join-school',
    '/verify/ABC',
    '/oauth/consent',
    '/dashboard/student',
    '/api/mcp',
  ])('leaves %s alone', (path) => {
    expect(isRetiredMarketingPath(path)).toBe(false)
  })
})
