import { NextResponse } from 'next/server'

export const COMMERCE_DISABLED_MESSAGE =
  'Commerce is disabled in this BotEducation deploy'

export function commerceGoneResponse(): NextResponse {
  return NextResponse.json({ error: COMMERCE_DISABLED_MESSAGE }, { status: 410 })
}
