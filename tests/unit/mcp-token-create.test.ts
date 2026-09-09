import { describe, expect, it } from 'vitest'
import {
  mcpEndpointUrl,
  mcpTokenCreatedAnalytics,
  mcpTokenInsertRow,
  professorPasteBlock,
  sanitizeCourseIds,
} from '@/lib/mcp/token-create'
import { sanitizeToolAllowlist } from '@/lib/mcp/professor-tools'

describe('mcp token helpers', () => {
  it('keeps unique positive course ids', () => {
    expect(sanitizeCourseIds([4, 4, '7', 0, -1, 3.2, 9])).toEqual([4, 7, 9])
  })

  it('persists course_ids and professor role on insert', () => {
    const row = mcpTokenInsertRow({
      userId: 'user-1',
      tokenHash: 'abc',
      name: 'CS101 Grok',
      expiresAt: null,
      courseIds: [4],
      tokenRole: 'professor',
    })
    expect(row.course_ids).toEqual([4])
    expect(row.token_role).toBe('professor')
    expect(row.token_hash).toBe('abc')
  })

  it('never puts the raw token in analytics properties', () => {
    const payload = mcpTokenCreatedAnalytics('2026-01-01T00:00:00.000Z', 30)
    expect(payload).toEqual({ has_expiry: true, expires_in_days: 30 })
    expect(JSON.stringify(payload)).not.toMatch(/Bearer|token_hash|token/)
  })

  it('prints /api/mcp without /cli and keeps the tenant slug', () => {
    expect(mcpEndpointUrl('default-school', 'lmsplatform.com')).toBe(
      'https://default-school.lmsplatform.com/api/mcp',
    )
    expect(mcpEndpointUrl(null, 'lvh.me:3000')).toBe('https://lvh.me:3000/api/mcp')
  })

  it('builds the operator paste block from URL plus bearer token', () => {
    const block = professorPasteBlock('https://school.example/api/mcp', 'deadbeef')
    expect(block).toBe(
      'MCP URL\nhttps://school.example/api/mcp\nAuthorization\nBearer deadbeef',
    )
  })

  it('drops unknown tool names from the allowlist', () => {
    expect(sanitizeToolAllowlist(['lms_create_assignment', 'lms_delete_course', 'nope'])).toEqual([
      'lms_create_assignment',
    ])
  })
})
