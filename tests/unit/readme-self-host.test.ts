import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const readme = readFileSync('README.md', 'utf8')

describe('self-host README', () => {
  it('names BotEducation, credits lms-front, and keeps MIT', () => {
    expect(readme).toContain('# BotEducation')
    expect(readme).toContain('lms-front')
    expect(readme).toContain('MIT')
    expect(readme).toContain('student@e2etest.com')
    expect(readme).toContain('http://lvh.me:3000')
  })

  it('tells the operator to paste /api/mcp, not /cli', () => {
    expect(readme).toContain('/api/mcp')
    expect(readme).not.toContain('/api/mcp/cli')
  })

  it('does not sell Stripe Connect as the product', () => {
    expect(readme).not.toMatch(/Stripe Connect/)
  })
})
