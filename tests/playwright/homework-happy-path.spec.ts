import { test, expect } from '@playwright/test'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { loginAsStudent, loginAsTeacher } from './utils/auth'
import { BASE } from './utils/constants'

/**
 * Live submit → draft grade → publish. Needs local Supabase, Next on
 * http://lvh.me:3000, MCP on :3001 (proxied at /api/mcp), and a professor PAT.
 * Seed has no homework rows; this spec creates one through MCP.
 */
const COURSE_ID = 1001
const SCORE = 83
const ARTIFACTS = process.env.LIVE_VERIFY_ARTIFACTS || '/tmp/live-verify'

function professorPat(): string | null {
  if (process.env.PROFESSOR_PAT?.trim()) return process.env.PROFESSOR_PAT.trim()
  if (existsSync('/tmp/professor-pat.txt')) {
    return readFileSync('/tmp/professor-pat.txt', 'utf8').trim() || null
  }
  return null
}

function parseMcp(text: string): { result?: { structuredContent?: Record<string, unknown>; content?: { text?: string }[] }; error?: { message?: string } } {
  for (const line of text.split('\n')) {
    if (line.startsWith('data: ')) {
      return JSON.parse(line.slice(6)) as ReturnType<typeof parseMcp>
    }
  }
  return JSON.parse(text) as ReturnType<typeof parseMcp>
}

async function mcpCall(pat: string, name: string, args: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${pat}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`MCP ${name} HTTP ${res.status}: ${text.slice(0, 500)}`)
  }
  const parsed = parseMcp(text)
  if (parsed.error) {
    throw new Error(`MCP ${name}: ${parsed.error.message}`)
  }
  return parsed
}

test.describe('Homework submit, draft grade, publish', () => {
  test('student submits, unpublished score stays hidden, publish reveals it', async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000)
    const pat = professorPat()
    test.skip(
      !pat,
      'Needs a professor PAT at PROFESSOR_PAT or /tmp/professor-pat.txt (live MCP grade path).',
    )

    mkdirSync(ARTIFACTS, { recursive: true })

    const title = `Live homework ${Date.now()}`
    const created = await mcpCall(pat!, 'lms_create_assignment', {
      course_id: COURSE_ID,
      title,
      body: 'Write a short explanation of why unit tests catch regressions.',
      late_policy: { kind: 'accept' },
      max_score: 100,
    })
    const assignmentId = Number(
      (created.result?.structuredContent as { assignment_id?: number } | undefined)
        ?.assignment_id,
    )
    expect(assignmentId).toBeGreaterThan(0)

    const scoped = await mcpCall(pat!, 'lms_create_assignment', {
      course_id: 1002,
      title: `Out of scope ${Date.now()}`,
    })
    const denyText = `${scoped.result?.content?.[0]?.text ?? ''} ${JSON.stringify(scoped.error ?? {})}`
    expect(denyText).toMatch(/Access denied: this token is scoped to courses \[1001\], not course 1002/)

    await loginAsStudent(page)
    await page.goto(
      `${BASE}/en/dashboard/student/courses/${COURSE_ID}/assignments/${assignmentId}`,
    )
    await expect(page.getByRole('heading', { name: title })).toBeVisible({
      timeout: 30_000,
    })
    await page.getByLabel('Write your answer').fill(
      'Unit tests pin expected behavior so a later change that breaks it fails in CI instead of in production.',
    )
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByText(/Submitted /)).toBeVisible({ timeout: 30_000 })
    await page.screenshot({ path: `${ARTIFACTS}/01-student-submitted.png`, fullPage: true })

    await page.goto(`${BASE}/en/dashboard/student/courses/${COURSE_ID}/grades`)
    const row = page.locator('li').filter({ hasText: title })
    await expect(row.getByText('Pending')).toBeVisible({ timeout: 15_000 })
    await expect(row.getByText(`${SCORE} / 100`)).toHaveCount(0)
    await page.screenshot({ path: `${ARTIFACTS}/02-grades-pending.png`, fullPage: true })

    const listed = await mcpCall(pat!, 'lms_list_submissions', {
      assignment_id: assignmentId,
      limit: 20,
      offset: 0,
    })
    const submissions = (listed.result?.structuredContent as { submissions?: { submission_id: number }[] })
      ?.submissions ?? []
    expect(submissions.length).toBeGreaterThan(0)
    const submissionId = submissions[0].submission_id

    const graded = await mcpCall(pat!, 'lms_grade_assignment_submission', {
      submission_id: submissionId,
      score: SCORE,
      feedback: 'Clear and correct.',
      published: true,
    })
    const grade = graded.result?.structuredContent as {
      grade_id?: number
      published?: boolean
    }
    expect(grade?.published).toBe(false)
    expect(graded.result?.content?.[0]?.text ?? '').toContain('draft')

    await page.reload()
    await expect(row.getByText('Pending')).toBeVisible()
    await expect(row.getByText(`${SCORE} / 100`)).toHaveCount(0)

    await mcpCall(pat!, 'lms_publish_grade', { submission_id: submissionId })

    await page.reload()
    await expect(row.getByText(`${SCORE} / 100`)).toBeVisible({ timeout: 15_000 })
    await expect(row.getByText('Pending')).toHaveCount(0)
    await page.screenshot({ path: `${ARTIFACTS}/03-grades-published.png`, fullPage: true })

    // Logged-in students are bounced off /auth/login onto their dashboard.
    const adminPage = await browser.newPage()
    await loginAsTeacher(adminPage)
    await adminPage.goto(`${BASE}/en/dashboard/admin`)
    await expect(adminPage.getByRole('link', { name: 'Dashboard' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(adminPage.locator('a[href*="/dashboard/admin/store"]')).toHaveCount(0)
    await expect(adminPage.locator('a[href*="/dashboard/admin/payouts"]')).toHaveCount(0)
    await expect(adminPage.locator('a[href*="/dashboard/admin/billing"]')).toHaveCount(0)
    await expect(adminPage.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard/admin',
    )
    await adminPage.screenshot({ path: `${ARTIFACTS}/04-admin-no-commerce-nav.png`, fullPage: true })
    await adminPage.close()
  })
})
