import { existsSync, readFileSync } from 'fs'
import { execSync } from 'child_process'
import { describe, expect, it } from 'vitest'
import { COMMERCE_DISABLED_MESSAGE, getPaymentProvider } from '@/lib/payments'

describe('payments factory unhooked', () => {
  it('does not import provider modules or commerce secrets', () => {
    const src = readFileSync('lib/payments/index.ts', 'utf8')
    expect(src).not.toContain('stripe-provider')
    expect(src).not.toContain('paypal-provider')
    expect(src).not.toContain('STRIPE_SECRET_KEY')
  })

  it('has no remaining STRIPE_SECRET_KEY reads in app, components, or lib', () => {
    const out = execSync(
      "grep -R 'STRIPE_SECRET_KEY' app components lib || true",
      { encoding: 'utf8' },
    )
    expect(out).toBe('')
  })

  it('throws without reading Stripe env', () => {
    delete process.env.STRIPE_SECRET_KEY
    expect(() => getPaymentProvider('stripe')).toThrow(COMMERCE_DISABLED_MESSAGE)
  })

  it('deletes the provider class modules', () => {
    const gone = [
      'lib/payments/stripe-provider.ts',
      'lib/payments/paypal-provider.ts',
      'lib/payments/binance-provider.ts',
      'lib/payments/binance-personal-provider.ts',
      'lib/payments/lemonsqueezy-provider.ts',
      'lib/payments/solana-provider.ts',
      'lib/payments/solana-subscriptions-provider.ts',
      'lib/payments/manual-provider.ts',
    ]
    for (const file of gone) {
      expect(existsSync(file), file).toBe(false)
    }
  })
})
