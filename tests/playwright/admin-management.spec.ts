import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './utils/auth'
import { TENANT_BASE } from './utils/constants'
import { expectCommerceRedirect } from './utils/commerce-gone'

/**
 * P1 — Admin Management Tests
 * Covers payment requests, subscriptions, notifications, billing, analytics.
 */

test.describe('Admin Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('admin payment requests URL redirects away from the deleted UI', async ({ page }) => {
    await expectCommerceRedirect(
      page,
      `${TENANT_BASE}/en/dashboard/admin/payment-requests`,
      /\/payment-requests/,
    )
  })

  test('admin subscriptions URL redirects away from the deleted UI', async ({ page }) => {
    await expectCommerceRedirect(
      page,
      `${TENANT_BASE}/en/dashboard/admin/subscriptions`,
      /\/subscriptions/,
    )
  })

  test('admin notifications page loads', async ({ page }) => {
    await page.goto(`${TENANT_BASE}/en/dashboard/admin/notifications`)
    await expect(page.getByTestId('notifications-page')).toBeVisible()
  })

  test('admin notification templates page loads', async ({ page }) => {
    await page.goto(
      `${TENANT_BASE}/en/dashboard/admin/notifications/templates`
    )
    await expect(
      page.getByTestId('notification-templates-page')
    ).toBeVisible()
  })

  test('admin billing URL redirects away from the deleted UI', async ({ page }) => {
    await expectCommerceRedirect(
      page,
      `${TENANT_BASE}/en/dashboard/admin/billing`,
      /\/billing/,
    )
  })

  test('admin billing upgrade URL redirects away from the deleted UI', async ({
    page,
  }) => {
    await expectCommerceRedirect(
      page,
      `${TENANT_BASE}/en/dashboard/admin/billing/upgrade`,
      /\/billing/,
    )
  })

  test('admin analytics page loads', async ({ page }) => {
    await page.goto(`${TENANT_BASE}/en/dashboard/admin/analytics`)
    await expect(page.getByTestId('analytics-page')).toBeVisible()
  })

  test('admin can access teacher course creation', async ({ page }) => {
    await page.goto(`${TENANT_BASE}/en/dashboard/teacher/courses/new`, {
      timeout: 40_000,
    })
    await expect(page.getByLabel(/title/i)).toBeVisible()
  })
})
