import { beforeEach, describe, expect, it, vi } from 'vitest'

const inserted: Record<string, unknown>[] = []
const trackCalls: unknown[][] = []
let accessibleCourseIds = [4]
let role = 'teacher'

function makeClient() {
  return {
    from() {
      const b: Record<string, unknown> = {
        insert(values: Record<string, unknown>) {
          inserted.push(values)
          return Promise.resolve({ error: null })
        },
        select() {
          return b
        },
        eq() {
          return b
        },
        in() {
          return Promise.resolve({
            data: accessibleCourseIds.map((course_id) => ({ course_id })),
            error: null,
          })
        },
      }
      return b
    },
  }
}

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/get-user-role', () => ({
  getUserRole: () => Promise.resolve(role),
}))
vi.mock('@/lib/supabase/tenant', () => ({
  getCurrentUserId: () => Promise.resolve('user-1'),
  getCurrentTenantId: () => Promise.resolve('tenant-1'),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve(makeClient()),
}))
vi.mock('@/lib/analytics/server', () => ({
  track: (...args: unknown[]) => {
    trackCalls.push(args)
    return Promise.resolve()
  },
  safeAnalytics: async (fn: () => Promise<void>) => {
    await fn()
  },
}))

import { createMcpToken } from '@/app/actions/mcp-tokens'

beforeEach(() => {
  inserted.length = 0
  trackCalls.length = 0
  accessibleCourseIds = [4]
  role = 'teacher'
})

describe('createMcpToken', () => {
  it('persists course_ids and professor role, and never logs the raw token', async () => {
    const result = await createMcpToken('CS101 Grok', 30, { courseIds: [4] })

    expect(inserted).toHaveLength(1)
    expect(inserted[0].course_ids).toEqual([4])
    expect(inserted[0].token_role).toBe('professor')
    expect(inserted[0].name).toBe('CS101 Grok')
    expect(typeof inserted[0].token_hash).toBe('string')
    expect(result.token).toMatch(/^[a-f0-9]{64}$/)
    expect(inserted[0].token_hash).not.toBe(result.token)

    expect(trackCalls).toHaveLength(1)
    const serialized = JSON.stringify(trackCalls)
    expect(serialized).not.toContain(result.token)
    expect(serialized).not.toContain(inserted[0].token_hash)
    expect(trackCalls[0][1]).toEqual({ has_expiry: true, expires_in_days: 30 })
  })

  it('rejects a course the caller cannot access', async () => {
    accessibleCourseIds = []
    await expect(createMcpToken('CS101 Grok', undefined, { courseIds: [99] })).rejects.toThrow(
      'One or more courses are not accessible',
    )
    expect(inserted).toHaveLength(0)
  })
})
