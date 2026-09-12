import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Former daily access-cutoff sweep. Self-hosted deploys do not schedule
 * cutoff. Keep the route so existing schedulers stay quiet.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const provided = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!cronSecret || provided !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return new NextResponse(null, { status: 204 })
}
