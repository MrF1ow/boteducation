const RETIRED_MARKETING_PATHS = [
  '/',
  '/create-school',
  '/creators',
  '/courses',
  '/about',
  '/p',
  '/pricing',
  '/platform-pricing',
  '/products',
  '/checkout',
] as const

/** Locale-stripped paths that used to be the SaaS/storefront public face. */
export function isRetiredMarketingPath(path: string): boolean {
  if (path === '/') return true
  return RETIRED_MARKETING_PATHS.some(
    (route) => route !== '/' && (path === route || path.startsWith(`${route}/`)),
  )
}
