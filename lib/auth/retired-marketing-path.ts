export const RETIRED_STOREFRONT_PATHS = ['/courses', '/pricing'] as const

const RETIRED_MARKETING_PATHS = [
  '/',
  '/create-school',
  '/creators',
  ...RETIRED_STOREFRONT_PATHS,
  '/about',
  '/p',
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
