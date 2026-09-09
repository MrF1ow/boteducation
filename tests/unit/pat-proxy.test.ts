import { describe, expect, it } from 'vitest'
import { parseValidatedPatRow, patProxyHeaders } from '@/lib/mcp/pat-proxy'

describe('pat-proxy', () => {
  it('treats empty course_ids as unrestricted', () => {
    const pat = parseValidatedPatRow({
      user_id: 'u1',
      user_role: 'teacher',
      token_id: 9,
      course_ids: [],
    })
    expect(pat.courseIds).toBeNull()
    expect(patProxyHeaders('jwt', pat.courseIds)['x-mcp-course-ids']).toBe('')
  })

  it('forwards course_ids on the internal hop', () => {
    const pat = parseValidatedPatRow({
      user_id: 'u1',
      user_role: 'teacher',
      token_id: 9,
      course_ids: [4, 7],
    })
    expect(pat.courseIds).toEqual([4, 7])
    const headers = patProxyHeaders('minted-jwt', pat.courseIds)
    expect(headers.authorization).toBe('Bearer minted-jwt')
    expect(headers['x-mcp-course-ids']).toBe('4,7')
  })
})
