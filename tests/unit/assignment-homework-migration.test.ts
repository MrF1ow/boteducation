import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260909140000_assignment_homework_schema.sql',
  ),
  'utf8',
)

describe('assignment homework migration', () => {
  it('drops the open assignment select policy', () => {
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Authenticated users can view assignments"',
    )
    expect(migration).toContain('has_course_access')
  })

  it('retargets grades off exam_submissions or creates assignment_grades', () => {
    expect(migration).toContain('DROP CONSTRAINT IF EXISTS grades_submission_id_fkey')
    expect(migration).toContain('REFERENCES public.submissions(submission_id)')
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.assignment_grades')
  })

  it('gates student grade select on published', () => {
    expect(migration).toContain('Students can view published own grades')
    expect(migration).toContain('published = true')
  })

  it('scopes professor bots to staff and returns course_ids on token validate', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.course_professor_bots')
    expect(migration).toContain('course_ids integer[]')
    expect(migration).toContain('t.course_ids')
  })

  it('builds a calendar view over assignments and exams', () => {
    expect(migration).toContain('CREATE VIEW public.course_calendar_items')
    expect(migration).toContain("'assignment'::text AS item_kind")
    expect(migration).toContain("'exam'::text AS item_kind")
  })
})
