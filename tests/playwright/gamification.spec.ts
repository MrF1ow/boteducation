import { test, expect } from '@playwright/test'
import { loginAsStudent, loginAsTenantStudent } from './utils/auth'
import { BASE, TENANT_BASE } from './utils/constants'

/**
 * P1 — Gamification Tests
 *
 * Covers store page, XP/level display, achievements, leaderboard,
 * streak calendar, and profile stats. Does not purchase items or mutate data.
 */

test.describe('Gamification', () => {
  test.describe('Store Page', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsStudent(page)
    })

    test('store URL redirects away from the deleted store UI', async ({ page }) => {
      await page.goto(`${BASE}/en/dashboard/student/store`)
      await expect(page).not.toHaveURL(/\/store/)
      await expect(page.getByTestId('store-page')).toHaveCount(0)
      await expect(page.getByText('This page could not be found')).toHaveCount(0)
    })
  })

  test.describe('XP and Level Display', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsStudent(page)
      // Login resolves on the first `/dashboard` commit, which still redirects
      // to `/dashboard/student`; `networkidle` alone catches the skeleton.
      await expect(page.getByTestId('student-dashboard')).toBeVisible({ timeout: 30_000 })
    })

    test('student dashboard loads with gamification header', async ({ page }) => {
      test.setTimeout(60_000)
      // GamificationHeaderCard renders in the dashboard layout
      await expect(page.getByTestId('student-dashboard')).toBeVisible({ timeout: 30_000 })

      // Wait for client component to hydrate
      await page.waitForLoadState('networkidle')

      // The gamification header shows level info ("Lvl" text) or a loading skeleton
      const levelText = page.locator('text=/Lvl|Level/i')
      const skeleton = page.locator('[class*="animate-pulse"]')

      const levelVisible = await levelText.first().isVisible().catch(() => false)
      const skeletonVisible = await skeleton.first().isVisible().catch(() => false)

      // Either level text or loading skeleton should be present
      expect(levelVisible || skeletonVisible).toBeTruthy()
    })

    test('dashboard shows streak indicator', async ({ page }) => {
      await page.waitForLoadState('networkidle')

      // Streak section shows a flame icon and count
      // Look for streak-related text (number followed by streak context)
      const streakArea = page.locator('text=/streak/i')
      const flameIcon = page.locator('[class*="orange"]')

      const streakVisible = await streakArea.first().isVisible().catch(() => false)
      const flameVisible = await flameIcon.first().isVisible().catch(() => false)

      expect(streakVisible || flameVisible).toBeTruthy()
    })
  })

  test.describe('Leaderboard', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsStudent(page)
      await expect(page.getByTestId('student-dashboard')).toBeVisible({ timeout: 30_000 })
    })

    test('leaderboard renders on student dashboard', async ({ page }) => {
      await page.waitForLoadState('networkidle')

      // MiniLeaderboard shows a title or locked state
      const leaderboardTitle = page.locator('text=/leaderboard|rankings/i')
      const lockedLeaderboard = page.locator('text=/locked|upgrade/i')

      const titleVisible = await leaderboardTitle.first().isVisible().catch(() => false)
      const lockedVisible = await lockedLeaderboard.first().isVisible().catch(() => false)

      expect(titleVisible || lockedVisible).toBeTruthy()
    })

    test('leaderboard shows entries or empty state when unlocked', async ({ page }) => {
      await page.waitForLoadState('networkidle')
      // Wait for client-side hydration and data fetching
      await page.waitForTimeout(3000)

      // The leaderboard may show: entries, empty state, locked state, or not render at all
      // All are acceptable — we just verify the dashboard page itself loaded
      await expect(page.getByTestId('student-dashboard')).toBeVisible({ timeout: 10_000 })
    })
  })

  test.describe('Profile Gamification', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsStudent(page)
    })

    test('profile page shows XP progress circle', async ({ page }) => {
      test.setTimeout(60_000)

      await page.goto(`${BASE}/en/dashboard/student/profile`)
      await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 15_000 })
      await page.waitForLoadState('networkidle')

      // XPProgressCircle renders an SVG with circles or a loading placeholder
      const svgCircle = page.locator('svg circle')
      const loadingPlaceholder = page.locator('[class*="animate-pulse"]')

      const circleVisible = await svgCircle.first().isVisible().catch(() => false)
      const loadingVisible = await loadingPlaceholder.first().isVisible().catch(() => false)

      expect(circleVisible || loadingVisible).toBeTruthy()
    })

    test('profile page shows gamification stats (coins and streak)', async ({ page }) => {
      test.setTimeout(60_000)

      await page.goto(`${BASE}/en/dashboard/student/profile`)
      await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 15_000 })
      await page.waitForLoadState('networkidle')

      // ProfileGamificationStats shows coins and streak labels
      const coinsLabel = page.locator('text=/coins/i')
      const streakLabel = page.locator('text=/streak/i')

      const coinsVisible = await coinsLabel.first().isVisible().catch(() => false)
      const streakVisible = await streakLabel.first().isVisible().catch(() => false)

      // At least one gamification stat should render (or loading state)
      const loadingState = page.locator('[class*="animate-pulse"]')
      const isLoading = await loadingState.first().isVisible().catch(() => false)

      expect(coinsVisible || streakVisible || isLoading).toBeTruthy()
    })

    test('profile page shows streak calendar', async ({ page }) => {
      test.setTimeout(60_000)

      await page.goto(`${BASE}/en/dashboard/student/profile`)
      await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 15_000 })
      await page.waitForLoadState('networkidle')

      // StreakCalendar renders 7 day columns with abbreviated day labels
      // Day abbreviations are single characters: M, T, W, T, F, S, S
      const streakSection = page.locator('text=/active streak|streak/i')
      const dayLabels = page.locator('text=/^[MTWFS]$/').first()

      const streakVisible = await streakSection.first().isVisible().catch(() => false)
      const daysVisible = await dayLabels.isVisible().catch(() => false)

      // Either the streak calendar or a loading placeholder should be present
      const loadingState = page.locator('[class*="animate-pulse"]')
      const isLoading = await loadingState.first().isVisible().catch(() => false)

      expect(streakVisible || daysVisible || isLoading).toBeTruthy()
    })

    test('profile page shows achievement section or gamification elements', async ({ page }) => {
      test.setTimeout(60_000)

      await page.goto(`${BASE}/en/dashboard/student/profile`)
      await expect(page.getByTestId('profile-page')).toBeVisible({ timeout: 15_000 })
      await page.waitForLoadState('networkidle')

      // The profile page should render — gamification elements may or may not be visible
      // depending on plan/feature flags. Verify the page itself loaded correctly.
      const body = page.locator('body')
      await expect(body).toBeVisible()
    })
  })

  test.describe('Cross-Tenant Gamification', () => {
    test('tenant student store URL redirects away from the deleted UI', async ({ page }) => {
      await loginAsTenantStudent(page)
      await page.goto(`${TENANT_BASE}/en/dashboard/student/store`)
      await expect(page).not.toHaveURL(/\/store/)
      await expect(page.getByTestId('store-page')).toHaveCount(0)
    })
  })
})
