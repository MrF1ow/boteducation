'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Switch } from '@/components/ui/switch'
import { updateSetting } from '@/app/actions/admin/settings'
import { toast } from 'sonner'

export function AutoPublishGradesToggle({ enabled }: { enabled: boolean }) {
  const t = useTranslations('dashboard.admin.settings.sections.grading')
  const [value, setValue] = useState(enabled)
  const [saving, setSaving] = useState(false)

  async function handleToggle(checked: boolean) {
    setValue(checked)
    setSaving(true)
    const result = await updateSetting('auto_publish_grades', { enabled: checked })
    setSaving(false)
    if (!result.success) {
      setValue(!checked)
      toast.error(result.error || t('saveError'))
      return
    }
    toast.success(t('saved'))
  }

  return (
    <div className="flex items-start gap-3">
      <Switch
        checked={value}
        onCheckedChange={handleToggle}
        disabled={saving}
        aria-label={t('autoPublish')}
      />
      <div className="space-y-1">
        <p className="text-sm font-medium">{t('autoPublish')}</p>
        <p className="text-sm text-muted-foreground">{t('autoPublishHint')}</p>
      </div>
    </div>
  )
}
