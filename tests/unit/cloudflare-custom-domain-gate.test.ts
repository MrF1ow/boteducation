/**
 * `createCloudflareSubdomain` is leftover vanity-domain DNS. Plan gates are
 * gone after leftover cleanup PR-01. Real Cloudflare errors still stop a write.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireAdmin = vi.fn()

vi.mock('@/lib/actions/utils', () => ({ requireAdmin: (...args: unknown[]) => requireAdmin(...args) }))

import { createCloudflareSubdomain } from '@/app/actions/cloudflare'

describe('createCloudflareSubdomain', () => {
  const fetchSpy = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchSpy)
    requireAdmin.mockResolvedValue({ tenantId: 'tenant-1', userId: 'user-1' })
    delete process.env.CLOUDFLARE_ZONE_ID
  })

  it('requires an admin before touching Cloudflare', async () => {
    requireAdmin.mockRejectedValue(new Error('Unauthorized'))

    await expect(createCloudflareSubdomain('my-school')).rejects.toThrow('Unauthorized')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects a malformed subdomain', async () => {
    await expect(createCloudflareSubdomain('Bad Slug!')).resolves.toEqual({
      success: false,
      reason: 'Invalid subdomain',
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('stops safely when Cloudflare is not configured', async () => {
    await expect(createCloudflareSubdomain('my-school')).resolves.toEqual({
      success: false,
      reason: 'Missing ENV vars',
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
