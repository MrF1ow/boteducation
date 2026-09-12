import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

const hook = readFileSync('lib/hooks/use-enrollment.ts', 'utf8')
const mcpEnroll = readFileSync('mcp-server/src/tools/enroll.ts', 'utf8')
const browsePage = readFileSync('app/[locale]/dashboard/student/browse/page.tsx', 'utf8')
const browseCard = readFileSync('components/student/browse-course-card.tsx', 'utf8')
const migration = readFileSync(
  'supabase/migrations/20260912220000_membership_self_enroll.sql',
  'utf8',
)

describe('membership self-enroll', () => {
  it('calls the membership RPC instead of the subscription enroll RPC', () => {
    expect(hook).toContain("rpc('self_enroll_school_course'")
    expect(hook).not.toContain('self_enroll_subscription_course')
    expect(mcpEnroll).toContain('self_enroll_school_course')
    expect(mcpEnroll).not.toContain('self_enroll_subscription_course')
  })

  it('does not treat a missing subscription as a user-facing failure', () => {
    expect(hook.toLowerCase()).not.toContain('no active subscription')
    expect(mcpEnroll.toLowerCase()).not.toContain('no active subscription')
    expect(migration).not.toContain('No active subscription')
    expect(migration).not.toMatch(/JOIN public\.plan_courses/)
    expect(migration).not.toMatch(/RAISE EXCEPTION '[^']*payment/i)
    expect(migration).toContain('self_enroll_school_course')
    expect(migration).toContain("'free'")
    expect(migration).toContain('INSERT INTO public.enrollments')
  })

  it('shows published tenant courses as enrolled or enrollable with no pricing lock', () => {
    expect(browsePage).not.toContain('/pricing')
    expect(browsePage).not.toContain('not-in-plan')
    expect(browsePage).not.toContain('no-subscription')
    expect(browsePage).not.toContain('getActiveSubscriptions')
    expect(browseCard).toContain("variant: 'enrolled'")
    expect(browseCard).toContain("variant: 'enrollable'")
    expect(browseCard).not.toContain('not-in-plan')
    expect(browseCard).not.toContain('no-subscription')
    expect(browseCard).not.toContain('/pricing')
    expect(browseCard).not.toContain('href="/courses')
    expect(browseCard).not.toContain('href={`/courses')
  })
})
