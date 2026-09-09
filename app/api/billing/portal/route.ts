import { commerceGoneResponse } from '@/lib/payments/commerce-disabled'

export const runtime = 'nodejs'

export async function GET() {
  return commerceGoneResponse()
}

export async function POST() {
  return commerceGoneResponse()
}
