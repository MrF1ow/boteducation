'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { saveProductCreationWizard } from '@/app/actions/admin/products'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { SaveIntent } from '@/lib/admin/product-creation/types'

interface QuickProductCreateProps {
  className?: string
}

/**
 * One-screen quick-create: title + free/paid + price + publish.
 * Everything else (category, thumbnail, after-purchase steps, provider choice)
 * is deferred with defaults — the full wizard stays at /dashboard/admin/products/new.
 */
export function QuickProductCreate({ className }: QuickProductCreateProps) {
  const t = useTranslations('dashboard.admin.products.new.quick')
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState<SaveIntent | null>(null)

  const canPublish = title.trim().length > 0

  const handleSave = async (intent: SaveIntent) => {
    if (saving) return
    setSaving(intent)
    try {
      const result = await saveProductCreationWizard({
        intent,
        course: {
          sourceMode: 'new',
          title: title.trim(),
          description: '',
          thumbnailUrl: '',
          categoryId: null,
        },
        pricing: { mode: 'free' },
        postRegistrationSteps: [],
      })

      if (!result.success || !result.data) {
        toast.error((!result.success && result.error) || t('saveError'))
        return
      }

      toast.success(intent === 'publish' ? t('published') : t('draftSaved'))
      // Land in the lesson editor, not the course overview: the course has no
      // lessons yet and a student can open nothing until one is published
      // (#665, #675). `from=new-course` shows the one-line hint there.
      router.push(`/dashboard/teacher/courses/${result.data.courseId}/lessons/new?from=new-course`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('saveError'))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className={cn('mx-auto w-full max-w-xl space-y-4', className)}>
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="space-y-6">
            <Field>
              <FieldLabel htmlFor="quick-title">{t('courseTitleLabel')}</FieldLabel>
              <FieldContent>
                <Input
                  id="quick-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('courseTitlePlaceholder')}
                  maxLength={200}
                />
              </FieldContent>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <div className="flex w-full gap-3">
            <Button
              className="flex-1"
              onClick={() => handleSave('publish')}
              disabled={!canPublish || saving !== null}
            >
              {saving === 'publish' ? t('publishing') : t('publish')}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSave('draft')}
              disabled={title.trim().length === 0 || saving !== null}
            >
              {saving === 'draft' ? t('savingDraft') : t('saveDraft')}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
