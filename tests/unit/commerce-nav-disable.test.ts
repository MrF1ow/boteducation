import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const sidebar = readFileSync('components/app-sidebar.tsx', 'utf8')
const adminHome = readFileSync('app/[locale]/dashboard/admin/page.tsx', 'utf8')
const analytics = readFileSync('app/[locale]/dashboard/admin/analytics/page.tsx', 'utf8')
const upgradeNudge = readFileSync('components/shared/upgrade-nudge.tsx', 'utf8')

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

  it('drops revenue and billing upgrade from analytics and upgrade nudges', () => {
    expect(analytics).not.toContain('netOfRefunds')
    expect(analytics).not.toContain('RevenueChart')
    expect(analytics).not.toContain("from('transactions')")
    expect(upgradeNudge).not.toContain('/dashboard/admin/billing/upgrade')
  })

  it('redirects leftover commerce URLs instead of rendering an empty 404', () => {
    const gone = readFileSync('components/commerce-gone-page.tsx', 'utf8')
    const layout = readFileSync('components/commerce-disabled-layout.tsx', 'utf8')
    const nextConfig = readFileSync('next.config.ts', 'utf8')
    expect(gone).toContain("redirect('/dashboard')")
    expect(layout).toContain("redirect('/dashboard')")
    expect(nextConfig).toContain('/dashboard/student/store')
    expect(nextConfig).toContain('/dashboard/admin/payouts')
    expect(nextConfig).toContain("destination: '/:locale/dashboard'")
    const storePage = readFileSync('app/[locale]/dashboard/student/store/[[...rest]]/page.tsx', 'utf8')
    const payoutsPage = readFileSync('app/[locale]/dashboard/admin/payouts/[[...rest]]/page.tsx', 'utf8')
    expect(storePage).toContain("@/components/commerce-gone-page")
    expect(payoutsPage).toContain("@/components/commerce-gone-page")
  })

  it('does not render cutoff as a live lock', () => {
    const banner = readFileSync('components/shared/access-cutoff-banner.tsx', 'utf8')
    expect(banner).not.toContain('/dashboard/admin/billing')
    expect(banner).toContain('return null')
  })
})
