import { COMMERCE_DISABLED_MESSAGE } from './commerce-disabled'
import type { IPaymentProvider, PaymentProvider } from './types'

export interface GetProviderOptions {
  webhookSecret?: string
}

export function getPaymentProvider(
  provider: PaymentProvider = 'stripe',
  options: GetProviderOptions = {},
): IPaymentProvider {
  throw new Error(`${COMMERCE_DISABLED_MESSAGE} (${provider}${options.webhookSecret ? ', webhook' : ''})`)
}

export function getDefaultPaymentProvider(): IPaymentProvider {
  throw new Error(COMMERCE_DISABLED_MESSAGE)
}

export * from './types'
export { COMMERCE_DISABLED_MESSAGE } from './commerce-disabled'
