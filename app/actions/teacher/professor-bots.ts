'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/supabase/get-user-role'
import { getCurrentTenantId, getCurrentUserId } from '@/lib/supabase/tenant'
import { parseLatePolicy, type LatePolicy } from '@/lib/assignments/late-policy'
import { sanitizeToolAllowlist } from '@/lib/mcp/professor-tools'

export type ProfessorBot = {
  id: string
  course_id: number
  name: string
  system_prompt: string
  rubric_rules: string
  late_policy: LatePolicy
  model: string
  tool_allowlist: string[]
  mcp_token_id: number | null
}

export type ProfessorBotInput = {
  name: string
  system_prompt: string
  rubric_rules: string
  late_policy: unknown
  model: string
  tool_allowlist: unknown
  mcp_token_id: number | null
}

async function requireStaff(): Promise<{ userId: string; tenantId: string }> {
  const role = await getUserRole()
  if (role !== 'teacher' && role !== 'admin') {
    throw new Error('Unauthorized')
  }
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('Not authenticated')
  const tenantId = await getCurrentTenantId()
  return { userId, tenantId }
}

async function assertStaffCourse(courseId: number, tenantId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('courses')
    .select('course_id')
    .eq('course_id', courseId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Course not found')
}

async function assertOwnedToken(userId: string, tokenId: number | null) {
  if (tokenId === null) return
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mcp_api_tokens')
    .select('id')
    .eq('id', tokenId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Token not found')
}

function normalizeInput(input: ProfessorBotInput) {
  const name = input.name.trim()
  if (!name) throw new Error('Name is required')
  const model = input.model.trim() || 'grok-4'
  return {
    name: name.slice(0, 120),
    system_prompt: input.system_prompt,
    rubric_rules: input.rubric_rules,
    late_policy: parseLatePolicy(input.late_policy),
    model: model.slice(0, 64),
    tool_allowlist: sanitizeToolAllowlist(input.tool_allowlist),
    mcp_token_id: input.mcp_token_id,
  }
}

function revalidateCourse(courseId: number) {
  revalidatePath(`/dashboard/teacher/courses/${courseId}/settings`)
}

export async function listProfessorBots(courseId: number): Promise<ProfessorBot[]> {
  const { tenantId } = await requireStaff()
  await assertStaffCourse(courseId, tenantId)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('course_professor_bots')
    .select(
      'id, course_id, name, system_prompt, rubric_rules, late_policy, model, tool_allowlist, mcp_token_id',
    )
    .eq('course_id', courseId)
    .order('created_at')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    ...row,
    late_policy: parseLatePolicy(row.late_policy),
  }))
}

export async function createProfessorBot(courseId: number, input: ProfessorBotInput) {
  const { userId, tenantId } = await requireStaff()
  await assertStaffCourse(courseId, tenantId)
  const row = normalizeInput(input)
  await assertOwnedToken(userId, row.mcp_token_id)
  const supabase = await createClient()
  const { error } = await supabase.from('course_professor_bots').insert({
    course_id: courseId,
    ...row,
  })
  if (error) throw new Error(error.message)
  revalidateCourse(courseId)
}

export async function updateProfessorBot(
  courseId: number,
  botId: string,
  input: ProfessorBotInput,
) {
  const { userId, tenantId } = await requireStaff()
  await assertStaffCourse(courseId, tenantId)
  const row = normalizeInput(input)
  await assertOwnedToken(userId, row.mcp_token_id)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('course_professor_bots')
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq('id', botId)
    .eq('course_id', courseId)
    .select('id')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Professor bot not found')
  revalidateCourse(courseId)
}

export async function deleteProfessorBot(courseId: number, botId: string) {
  const { tenantId } = await requireStaff()
  await assertStaffCourse(courseId, tenantId)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('course_professor_bots')
    .delete()
    .eq('id', botId)
    .eq('course_id', courseId)
    .select('id')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Professor bot not found')
  revalidateCourse(courseId)
}
