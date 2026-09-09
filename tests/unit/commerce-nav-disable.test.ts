import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const sidebar = readFileSync('components/app-sidebar.tsx', 'utf8')
const adminHome = readFileSync('app/[locale]/dashboard/admin/page.tsx', 'utf8')

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

  it('drops revenue, payouts, and payment onboarding from admin home', () => {
    expect(adminHome).not.toContain('/dashboard/admin/transactions')
    expect(adminHome).not.toContain('/dashboard/admin/payment-requests')
    expect(adminHome).not.toContain('/dashboard/admin/billing')
    expect(adminHome).not.toContain('netOfRefunds')
    expect(adminHome).not.toContain('connect-payments')
    expect(adminHome).toContain('data-testid="admin-stats-grid"')
  })
})
