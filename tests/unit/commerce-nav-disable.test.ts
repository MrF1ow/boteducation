import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const sidebar = readFileSync('components/app-sidebar.tsx', 'utf8')

describe('commerce nav disable', () => {
  it('drops store, billing, payouts, and platform billing from the school shell', () => {
    expect(sidebar).not.toContain('/dashboard/student/store')
    expect(sidebar).not.toContain('/dashboard/student/billing')
    expect(sidebar).not.toContain('/dashboard/student/payments')
    expect(sidebar).not.toContain('/dashboard/admin/payouts')
    expect(sidebar).not.toContain('/dashboard/admin/products')
    expect(sidebar).not.toContain('/dashboard/admin/monetization')
    expect(sidebar).not.toContain('/dashboard/teacher/revenue')
    expect(sidebar).not.toContain('/dashboard/admin/billing')
  })

  it('keeps MCP tokens in both staff shells', () => {
    expect(sidebar).toContain('/dashboard/admin/api-tokens')
    expect(sidebar).toContain('/dashboard/teacher/api-tokens')
  })
})
