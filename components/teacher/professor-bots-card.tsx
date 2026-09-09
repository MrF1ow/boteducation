'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import {
  createProfessorBot,
  deleteProfessorBot,
  updateProfessorBot,
  type ProfessorBot,
} from '@/app/actions/teacher/professor-bots'
import { PROFESSOR_TOOL_OPTIONS } from '@/lib/mcp/professor-tools'
import { DEFAULT_LATE_POLICY, type LatePolicy } from '@/lib/assignments/late-policy'

type TokenOption = { id: number; name: string }

interface ProfessorBotsCardProps {
  courseId: number
  bots: ProfessorBot[]
  tokens: TokenOption[]
}

const EMPTY_DRAFT: ProfessorBotFormState = {
  name: '',
  system_prompt: '',
  rubric_rules: '',
  lateKind: 'reject',
  until: '',
  percentPerDay: '10',
  model: 'grok-4',
  tool_allowlist: [],
  mcp_token_id: null,
}

type ProfessorBotFormState = {
  name: string
  system_prompt: string
  rubric_rules: string
  lateKind: LatePolicy['kind']
  until: string
  percentPerDay: string
  model: string
  tool_allowlist: string[]
  mcp_token_id: number | null
}

function stateFromBot(bot: ProfessorBot): ProfessorBotFormState {
  return {
    name: bot.name,
    system_prompt: bot.system_prompt,
    rubric_rules: bot.rubric_rules,
    lateKind: bot.late_policy.kind,
    until: bot.late_policy.kind === 'accept_until' ? bot.late_policy.until.slice(0, 16) : '',
    percentPerDay:
      bot.late_policy.kind === 'penalize' ? String(bot.late_policy.percent_per_day) : '10',
    model: bot.model,
    tool_allowlist: bot.tool_allowlist,
    mcp_token_id: bot.mcp_token_id,
  }
}

function latePolicyFromState(state: ProfessorBotFormState): LatePolicy {
  if (state.lateKind === 'accept_until') {
    const parsed = Date.parse(state.until)
    return Number.isFinite(parsed)
      ? { kind: 'accept_until', until: new Date(parsed).toISOString() }
      : DEFAULT_LATE_POLICY
  }
  if (state.lateKind === 'penalize') {
    const percent = Number(state.percentPerDay)
    return Number.isFinite(percent)
      ? { kind: 'penalize', percent_per_day: percent }
      : DEFAULT_LATE_POLICY
  }
  if (state.lateKind === 'accept') return { kind: 'accept' }
  return { kind: 'reject' }
}

function inputFromState(state: ProfessorBotFormState) {
  return {
    name: state.name,
    system_prompt: state.system_prompt,
    rubric_rules: state.rubric_rules,
    late_policy: latePolicyFromState(state),
    model: state.model,
    tool_allowlist: state.tool_allowlist,
    mcp_token_id: state.mcp_token_id,
  }
}

function toggleId(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id]
}

function ProfessorBotFields({
  state,
  tokens,
  onChange,
  idPrefix,
}: {
  state: ProfessorBotFormState
  tokens: TokenOption[]
  onChange: (next: ProfessorBotFormState) => void
  idPrefix: string
}) {
  const t = useTranslations('dashboard.teacher.manageCourse.professorBots')
  const tokenValue = state.mcp_token_id === null ? 'none' : String(state.mcp_token_id)

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>{t('name')}</Label>
        <Input
          id={`${idPrefix}-name`}
          value={state.name}
          onChange={(e) => onChange({ ...state, name: e.target.value })}
          placeholder={t('namePlaceholder')}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-prompt`}>{t('systemPrompt')}</Label>
        <Textarea
          id={`${idPrefix}-prompt`}
          value={state.system_prompt}
          onChange={(e) => onChange({ ...state, system_prompt: e.target.value })}
          placeholder={t('systemPromptPlaceholder')}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-rubric`}>{t('rubricRules')}</Label>
        <Textarea
          id={`${idPrefix}-rubric`}
          value={state.rubric_rules}
          onChange={(e) => onChange({ ...state, rubric_rules: e.target.value })}
          placeholder={t('rubricRulesPlaceholder')}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-late`}>{t('latePolicy')}</Label>
          <Select
            value={state.lateKind}
            onValueChange={(v) => {
              if (!v) return
              onChange({ ...state, lateKind: v as LatePolicy['kind'] })
            }}
          >
            <SelectTrigger id={`${idPrefix}-late`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reject">{t('lateReject')}</SelectItem>
              <SelectItem value="accept">{t('lateAccept')}</SelectItem>
              <SelectItem value="accept_until">{t('lateAcceptUntil')}</SelectItem>
              <SelectItem value="penalize">{t('latePenalize')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-model`}>{t('model')}</Label>
          <Input
            id={`${idPrefix}-model`}
            value={state.model}
            onChange={(e) => onChange({ ...state, model: e.target.value })}
          />
        </div>
      </div>
      {state.lateKind === 'accept_until' ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-until`}>{t('acceptUntil')}</Label>
          <Input
            id={`${idPrefix}-until`}
            type="datetime-local"
            value={state.until}
            onChange={(e) => onChange({ ...state, until: e.target.value })}
          />
        </div>
      ) : null}
      {state.lateKind === 'penalize' ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-percent`}>{t('percentPerDay')}</Label>
          <Input
            id={`${idPrefix}-percent`}
            type="number"
            min="0"
            step="1"
            value={state.percentPerDay}
            onChange={(e) => onChange({ ...state, percentPerDay: e.target.value })}
          />
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-token`}>{t('linkedToken')}</Label>
        <Select
          value={tokenValue}
          onValueChange={(v) => {
            if (!v) return
            onChange({
              ...state,
              mcp_token_id: v === 'none' ? null : Number(v),
            })
          }}
        >
          <SelectTrigger id={`${idPrefix}-token`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t('noToken')}</SelectItem>
            {tokens.map((token) => (
              <SelectItem key={token.id} value={String(token.id)}>
                {token.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('toolAllowlist')}</legend>
        <p className="text-sm text-muted-foreground">{t('toolAllowlistHint')}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PROFESSOR_TOOL_OPTIONS.map((tool) => (
            <label key={tool} className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={state.tool_allowlist.includes(tool)}
                onCheckedChange={() =>
                  onChange({ ...state, tool_allowlist: toggleId(state.tool_allowlist, tool) })
                }
              />
              <span className="font-mono text-xs leading-5">{tool}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

function ExistingProfessorBot({
  courseId,
  bot,
  tokens,
}: {
  courseId: number
  bot: ProfessorBot
  tokens: TokenOption[]
}) {
  const t = useTranslations('dashboard.teacher.manageCourse.professorBots')
  const router = useRouter()
  const [state, setState] = useState(() => stateFromBot(bot))
  const [isPending, startTransition] = useTransition()

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <ProfessorBotFields
        state={state}
        tokens={tokens}
        onChange={setState}
        idPrefix={bot.id}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              try {
                await updateProfessorBot(courseId, bot.id, inputFromState(state))
                router.refresh()
                toast.success(t('saved'))
              } catch (err) {
                toast.error(err instanceof Error ? err.message : t('saveError'))
              }
            })
          }}
        >
          {isPending ? t('saving') : t('save')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              try {
                await deleteProfessorBot(courseId, bot.id)
                router.refresh()
                toast.success(t('deleted'))
              } catch (err) {
                toast.error(err instanceof Error ? err.message : t('deleteError'))
              }
            })
          }}
        >
          <IconTrash className="mr-1.5 size-4" />
          {t('delete')}
        </Button>
      </div>
    </div>
  )
}

function NewProfessorBot({
  courseId,
  tokens,
}: {
  courseId: number
  tokens: TokenOption[]
}) {
  const t = useTranslations('dashboard.teacher.manageCourse.professorBots')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState(EMPTY_DRAFT)
  const [isPending, startTransition] = useTransition()

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <IconPlus className="mr-1.5 size-4" />
        {t('add')}
      </Button>
    )
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <ProfessorBotFields
        state={state}
        tokens={tokens}
        onChange={setState}
        idPrefix="new"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              try {
                await createProfessorBot(courseId, inputFromState(state))
                router.refresh()
                toast.success(t('created'))
                setState(EMPTY_DRAFT)
                setOpen(false)
              } catch (err) {
                toast.error(err instanceof Error ? err.message : t('saveError'))
              }
            })
          }}
        >
          {isPending ? t('saving') : t('create')}
        </Button>
        <Button type="button" variant="ghost" disabled={isPending} onClick={() => setOpen(false)}>
          {t('cancel')}
        </Button>
      </div>
    </div>
  )
}

export function ProfessorBotsCard({ courseId, bots, tokens }: ProfessorBotsCardProps) {
  const t = useTranslations('dashboard.teacher.manageCourse.professorBots')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {bots.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          bots.map((bot) => (
            <ExistingProfessorBot
              key={bot.id}
              courseId={courseId}
              bot={bot}
              tokens={tokens}
            />
          ))
        )}
        <NewProfessorBot courseId={courseId} tokens={tokens} />
      </CardContent>
    </Card>
  )
}
