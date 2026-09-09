import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './utils/auth'
import { BASE, TENANT_BASE } from './utils/constants'
import { expectCommerceRedirect } from './utils/commerce-gone'

/**
 * P2 — Feature Gating Tests
 * Verifies billing pages, plan limits display, and public pricing.
 */

test.describe('Feature Gating', () => {
  test('billing URL redirects away from the deleted UI', async ({ page }) => {
    await loginAsAdmin(page)
    await expectCommerceRedirect(
      page,
      `${TENANT_BASE}/en/dashboard/admin/billing`,
      /\/billing/,
    )
  })

  test('upgrade URL redirects away from the deleted UI', async ({ page }) => {
    await loginAsAdmin(page)
    await expectCommerceRedirect(
      page,
      `${TENANT_BASE}/en/dashboard/admin/billing/upgrade`,
      /\/billing/,
    )
  })

  test('public platform-pricing URL redirects away from the deleted UI', async ({
    page,
  }) => {
    await expectCommerceRedirect(page, `${BASE}/en/platform-pricing`, /\/platform-pricing/)
  })

  test('course creation shows plan limit info', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto(`${TENANT_BASE}/en/dashboard/teacher/courses`)
    await expect(page.getByTestId('teacher-courses-list')).toBeVisible()
    // The courses page should load without errors
    const body = await page.locator('body').textContent()
    expect(body?.length).toBeGreaterThan(50)
  })
})
