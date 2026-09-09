import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { attachCourseIdsClaim } from '@/lib/mcp/pat-jwt'

export async function mintUserAccessToken(
  userId: string,
  courseIds: number[] | null,
): Promise<string> {
  const admin = createAdminClient()
  const { data: userData, error: userError } =
    await admin.auth.admin.getUserById(userId)
  const email = userData.user?.email
  if (userError || !email) {
    throw new Error('PAT user not found')
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  const hashed = link.properties?.hashed_token
  if (linkError || !hashed) {
    throw new Error('Failed to mint a user session for the PAT')
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase URL and anon key are required to mint a PAT session')
  }

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: verified, error: otpError } = await anon.auth.verifyOtp({
    type: 'magiclink',
    token_hash: hashed,
  })
  const accessToken = verified.session?.access_token
  if (otpError || !accessToken) {
    throw new Error('Failed to verify the minted user session')
  }

  return attachCourseIdsClaim(
    accessToken,
    courseIds,
    process.env.SUPABASE_JWT_SECRET,
  )
}
