export type SupabaseStorageRemotePattern = {
  protocol: 'http' | 'https'
  hostname: string
  port?: string
  pathname: '/storage/v1/object/**'
}

export function supabaseStorageRemotePatterns(
  supabaseUrl: string | undefined,
): SupabaseStorageRemotePattern[] {
  if (!supabaseUrl) return []
  try {
    const parsed = new URL(supabaseUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return []
    if (!parsed.hostname) return []
    return [
      {
        protocol: parsed.protocol === 'http:' ? 'http' : 'https',
        hostname: parsed.hostname,
        ...(parsed.port ? { port: parsed.port } : {}),
        pathname: '/storage/v1/object/**',
      },
    ]
  } catch {
    return []
  }
}
