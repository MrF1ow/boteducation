import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createFakeSupabase, type Db } from './support/fake-supabase'
import { reconcileAccessCutoff, reconcileAccessCutoffSafely } from '@/lib/billing/access-cutoff'

/**
 * After leftover cleanup PR-01, `reconcileAccessCutoff` must not schedule or
 * write `tenants.access_cutoff_at`. Pure decision helpers stay covered in
 * `access-cutoff.test.ts`.
 */

const TENANT = '00000000-0000-0000-0000-000000000001'
const NOW = new Date('2026-07-01T12:00:00.000Z')
const CUTOFF = '2026-07-15T12:00:00.000Z'

function world(opts: { courses?: number; cutoffAt?: string | null } = {}) {
  const courses = opts.courses ?? 9
  const db: Db = {
    tenants: [
      {
        id: TENANT,
        name: 'Test School',
        plan: 'free',
        access_cutoff_at: opts.cutoffAt ?? null,
      },
    ],
    platform_plans: [{ slug: 'free', name: 'Free', limits: { max_courses: 5, max_students: 50 } }],
    courses: Array.from({ length: courses }, (_, i) => ({
      course_id: i + 1,
      tenant_id: TENANT,
      status: 'published',
    })),
    tenant_users: [{ user_id: 'admin-1', tenant_id: TENANT, role: 'admin', status: 'active' }],
    access_cutoff_notifications: [],
  }

  const { client } = createFakeSupabase(db)
  return { db, client: client as unknown as SupabaseClient }
}

const tenantRow = (db: Db) => db.tenants[0]

let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  errorSpy.mockRestore()
})

describe('reconcileAccessCutoff — leftover cleanup PR-01', () => {
  it('never schedules a cutoff when usage is over the old Free cap', async () => {
    const { db, client } = world({ courses: 9 })

    const decision = await reconcileAccessCutoff(client, TENANT, { now: NOW })

    expect(decision).toEqual({ action: 'none' })
    expect(tenantRow(db).access_cutoff_at).toBeNull()
  })

  it('does not clear an existing timestamp (the migration owns that write)', async () => {
    const { db, client } = world({ cutoffAt: CUTOFF, courses: 0 })

    const decision = await reconcileAccessCutoff(client, TENANT, { now: NOW })

    expect(decision.action).toBe('none')
    expect(tenantRow(db).access_cutoff_at).toBe(CUTOFF)
  })
})

describe('reconcileAccessCutoffSafely (#550 §1)', () => {
  it('does not throw when the client is unusable', async () => {
    const exploding = {
      from: () => {
        throw new Error('connection reset')
      },
    } as unknown as SupabaseClient

    await expect(reconcileAccessCutoffSafely(exploding, TENANT)).resolves.toBeUndefined()
  })
})
