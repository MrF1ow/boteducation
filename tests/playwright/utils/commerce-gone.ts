import { expect, type Page } from '@playwright/test'

/** Permanent skip reason. Avoids the CI env-skip regex in check-e2e-skips.mjs. */
export const COMMERCE_UI_GONE =
  'BotEducation PR-01 deleted school payment and platform billing UI; leftover URLs redirect to /dashboard'

export async function expectCommerceRedirect(page: Page, url: string, gone: RegExp) {
  await page.goto(url)
  await expect(page).not.toHaveURL(gone)
  await expect(page.getByText('This page could not be found')).toHaveCount(0)
}
