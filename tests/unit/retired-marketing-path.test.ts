import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'
import {
  isRetiredMarketingPath,
  RETIRED_STOREFRONT_PATHS,
} from '@/lib/auth/retired-marketing-path'

describe('isRetiredMarketingPath', () => {
  it.each([
    '/',
    '/create-school',
    '/creators',
    '/courses',
    '/courses/42',
    '/about',
    '/p/home',
    '/pricing',
    '/pricing/checkout',
    '/platform',
    '/platform/billing',
    '/checkout',
    '/platform-pricing',
  ])(
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
    '/dashboard/student/courses',
    '/api/mcp',
  ])('leaves %s alone', (path) => {
    expect(isRetiredMarketingPath(path)).toBe(false)
  })

  it('keeps /courses and /pricing retired in next redirects as well as proxy', () => {
    const nextConfig = readFileSync('next.config.ts', 'utf8')
    expect([...RETIRED_STOREFRONT_PATHS]).toEqual(['/courses', '/pricing'])
    expect(nextConfig).toContain('RETIRED_STOREFRONT_PATHS')
  })
})
