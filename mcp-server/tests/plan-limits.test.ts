/**
 * MCP plan-limit helpers after leftover cleanup PR-01.
 *
 * Course and member writes no longer read Free caps. `courseLimitHeadroomError`
 * always returns null. `isPlanLimitError` still recognises the retired SQLSTATE
 * so a leftover error string cannot be mistaken for a generic failure.
 */
import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PLAN_LIMIT_SQLSTATE,
  courseLimitHeadroomError,
  isPlanLimitError,
  planLimitMessage,
} from '../src/plan-limits.js'

function fakeClient(rpcResult: { data?: unknown; error?: unknown }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult)
  return { client: { rpc } as unknown as SupabaseClient, rpc }
}

describe('isPlanLimitError', () => {
  it('recognises the retired trigger SQLSTATE', () => {
    expect(isPlanLimitError({ code: PLAN_LIMIT_SQLSTATE, message: 'anything' })).toBe(true)
  })

  it('recognises the message when the code was lost in transit', () => {
    expect(isPlanLimitError({ message: 'plan_limit_exceeded:courses' })).toBe(true)
    expect(isPlanLimitError(new Error('plan_limit_exceeded:students'))).toBe(true)
  })

  it('ignores every other error', () => {
    expect(isPlanLimitError({ code: '23505', message: 'duplicate key' })).toBe(false)
    expect(isPlanLimitError(null)).toBe(false)
    expect(isPlanLimitError('plan_limit_exceeded:courses')).toBe(false)
  })
})

describe('courseLimitHeadroomError', () => {
  it('never refuses a write, even at the old Free cap', async () => {
    const { client, rpc } = fakeClient({
      data: { courses: 5, students: 3, max_courses: 5, max_students: 50 },
    })

    expect(await courseLimitHeadroomError(client, 'tenant-1')).toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('does not call the dropped usage RPC', async () => {
    const { client, rpc } = fakeClient({ error: { message: 'permission denied' } })
    expect(await courseLimitHeadroomError(client, 'tenant-1')).toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('planLimitMessage', () => {
  it('does not emit upgrade copy', async () => {
    const { client, rpc } = fakeClient({
      data: { students: 50, max_students: 50, courses: 1, max_courses: 5 },
    })
    const message = await planLimitMessage(client, 'tenant-1', 'students')
    expect(message).not.toContain('upgrade')
    expect(rpc).not.toHaveBeenCalled()
  })
})
