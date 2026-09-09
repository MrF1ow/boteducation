import { commerceGoneResponse } from '@/lib/payments/commerce-disabled'

export async function POST() {
  return commerceGoneResponse()
}
