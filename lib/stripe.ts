import { COMMERCE_DISABLED_MESSAGE } from '@/lib/payments/commerce-disabled'

export function getStripe(): never {
  throw new Error(COMMERCE_DISABLED_MESSAGE)
}

export function getWebhookSecret(): never {
  throw new Error(COMMERCE_DISABLED_MESSAGE)
}
