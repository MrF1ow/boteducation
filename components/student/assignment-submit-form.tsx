'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  submitAssignment,
  type SubmitAssignmentState,
} from '@/app/actions/student/assignments'

export function AssignmentSubmitForm({
  assignmentId,
  courseId,
  canSubmit,
}: {
  assignmentId: number
  courseId: number
  canSubmit: boolean
}) {
  const t = useTranslations('studentCourseWork')
  const [state, action, pending] = useActionState<SubmitAssignmentState, FormData>(
    submitAssignment,
    null,
  )

  const errorMessage =
    state?.error === 'late_rejected'
      ? t('lateRejected')
      : state?.error === 'locked'
        ? t('locked')
        : state?.error === 'empty'
          ? t('emptyAnswer')
          : state?.error
            ? t('error')
            : null

  if (!canSubmit) {
    return <p className="text-sm text-muted-foreground">{t('locked')}</p>
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="courseId" value={courseId} />
      <Textarea
        name="body"
        required
        minLength={1}
        placeholder={t('bodyPlaceholder')}
        aria-label={t('bodyPlaceholder')}
        className="min-h-32"
        disabled={pending}
      />
      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? t('submitting') : t('submit')}
      </Button>
    </form>
  )
}
