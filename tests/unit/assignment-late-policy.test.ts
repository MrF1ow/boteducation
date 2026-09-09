import { describe, expect, it } from 'vitest'
import {
  allowsStudentResubmit,
  applyLatePenalty,
  decideSubmissionWrite,
  parseLatePolicy,
  submissionStatus,
} from '@/lib/assignments/late-policy'
import {
  parseAutoPublishSetting,
  publishedOnWrite,
  studentCanReadGrade,
} from '@/lib/assignments/publish-gate'

describe('parseLatePolicy', () => {
  it('parses reject, accept, accept_until, and penalize', () => {
    expect(parseLatePolicy({ kind: 'reject' })).toEqual({ kind: 'reject' })
    expect(parseLatePolicy({ kind: 'accept' })).toEqual({ kind: 'accept' })
    expect(
      parseLatePolicy({ kind: 'accept_until', until: '2026-09-10T00:00:00.000Z' }),
    ).toEqual({ kind: 'accept_until', until: '2026-09-10T00:00:00.000Z' })
    expect(parseLatePolicy({ kind: 'penalize', percent_per_day: 10 })).toEqual({
      kind: 'penalize',
      percent_per_day: 10,
    })
  })

  it('falls back to reject for unknown json', () => {
    expect(parseLatePolicy({ kind: 'maybe' })).toEqual({ kind: 'reject' })
    expect(parseLatePolicy(null)).toEqual({ kind: 'reject' })
    expect(parseLatePolicy({ kind: 'penalize' })).toEqual({ kind: 'reject' })
  })
})

describe('decideSubmissionWrite', () => {
  const due = '2026-09-01T00:00:00.000Z'
  const late = new Date('2026-09-02T00:00:00.000Z')
  const onTime = new Date('2026-08-31T23:00:00.000Z')

  it('refuses a first submit after due when kind is reject', () => {
    expect(
      decideSubmissionWrite(due, { kind: 'reject' }, late, null),
    ).toEqual({ ok: false, reason: 'late_rejected' })
  })

  it('accepts a first submit before due', () => {
    expect(
      decideSubmissionWrite(due, { kind: 'reject' }, onTime, null),
    ).toEqual({ ok: true, status: 'submitted' })
  })

  it('locks a second submit when kind is reject', () => {
    expect(
      decideSubmissionWrite(due, { kind: 'reject' }, onTime, 'submitted'),
    ).toEqual({ ok: false, reason: 'locked' })
  })
})

describe('submissionStatus', () => {
  const due = '2026-09-01T00:00:00.000Z'
  const onTime = new Date('2026-08-31T23:00:00.000Z')
  const late = new Date('2026-09-02T00:00:00.000Z')

  it('accepts work before due_at', () => {
    expect(submissionStatus(due, onTime, { kind: 'reject' })).toBe('submitted')
  })

  it('rejects late work when kind is reject', () => {
    expect(submissionStatus(due, late, { kind: 'reject' })).toBe('rejected')
  })

  it('marks late work when kind is accept or penalize', () => {
    expect(submissionStatus(due, late, { kind: 'accept' })).toBe('late')
    expect(
      submissionStatus(due, late, { kind: 'penalize', percent_per_day: 5 }),
    ).toBe('late')
  })
})

describe('allowsStudentResubmit', () => {
  const now = new Date('2026-09-02T00:00:00.000Z')

  it('locks after submit when kind is reject', () => {
    expect(allowsStudentResubmit({ kind: 'reject' }, now)).toBe(false)
  })

  it('allows resubmit when kind is accept', () => {
    expect(allowsStudentResubmit({ kind: 'accept' }, now)).toBe(true)
  })
})

describe('applyLatePenalty', () => {
  it('subtracts percent_per_day for each started day after due_at', () => {
    const score = applyLatePenalty(
      100,
      { kind: 'penalize', percent_per_day: 10 },
      '2026-09-01T00:00:00.000Z',
      new Date('2026-09-03T00:00:00.000Z'),
    )
    expect(score).toBe(80)
  })
})

describe('publish gate', () => {
  it('hides unpublished grades from students', () => {
    expect(studentCanReadGrade(false)).toBe(false)
    expect(studentCanReadGrade(true)).toBe(true)
  })

  it('writes published when auto_publish is enabled', () => {
    expect(publishedOnWrite(false)).toBe(false)
    expect(publishedOnWrite(true)).toBe(true)
    expect(parseAutoPublishSetting({ enabled: false })).toBe(false)
    expect(parseAutoPublishSetting({ enabled: true })).toBe(true)
  })
})
