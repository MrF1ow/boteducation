'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { IconPlus, IconCopy, IconTrash, IconBan, IconCheck, IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import { toast } from 'sonner'
import {
  createMcpToken,
  revokeMcpToken,
  deleteMcpToken,
  type McpToken,
  type TokenScopeCourse,
} from '@/app/actions/mcp-tokens'
import { ConnectClaudeCard } from '@/components/dashboard/connect-claude-card'
import { professorPasteBlock } from '@/lib/mcp/token-create'
import { useRouter } from 'next/navigation'

interface ApiTokensPageProps {
  tokens: McpToken[]
  mcpUrl: string
  courses: TokenScopeCourse[]
}

export default function ApiTokensPage({ tokens, mcpUrl, courses }: ApiTokensPageProps) {
  const t = useTranslations('dashboard.admin.apiTokens')
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [revealedToken, setRevealedToken] = useState<string | null>(null)
  const [tokenName, setTokenName] = useState('')
  const [expiration, setExpiration] = useState<string>('never')
  const [courseIds, setCourseIds] = useState<number[]>([])
  const [isPending, startTransition] = useTransition()
  const [copied, setCopied] = useState<'token' | 'config' | 'paste' | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)

  const connectorUrl = mcpUrl.replace(/\/cli$/, '')

  const toggleCourse = (courseId: number) => {
    setCourseIds((current) =>
      current.includes(courseId)
        ? current.filter((id) => id !== courseId)
        : [...current, courseId],
    )
  }

  const resetCreateForm = () => {
    setRevealedToken(null)
    setTokenName('')
    setExpiration('never')
    setCourseIds([])
  }

  const handleCreate = () => {
    if (!tokenName.trim()) {
      toast.error(t('toasts.nameRequired'))
      return
    }
    startTransition(async () => {
      try {
        const expiresInDays = expiration === 'never' ? undefined : Number(expiration)
        const result = await createMcpToken(tokenName.trim(), expiresInDays, { courseIds })
        setRevealedToken(result.token)
        setTokenName('')
        setExpiration('never')
        router.refresh()
        toast.success(t('toasts.created'))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('toasts.createError'))
      }
    })
  }

  const handleRevoke = (tokenId: number) => {
    startTransition(async () => {
      try {
        await revokeMcpToken(tokenId)
        router.refresh()
        toast.success(t('toasts.revoked'))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('toasts.revokeError'))
      }
    })
  }

  const handleDelete = (tokenId: number) => {
    startTransition(async () => {
      try {
        await deleteMcpToken(tokenId)
        router.refresh()
        toast.success(t('toasts.deleted'))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('toasts.deleteError'))
      }
    })
  }

  const copyToClipboard = async (text: string, type: 'token' | 'config' | 'paste') => {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const configSnippet = (token: string) => JSON.stringify({
    mcpServers: {
      lms: {
        url: mcpUrl,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    },
  }, null, 2)

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }

  const courseTitleById = new Map(courses.map((course) => [course.course_id, course.title]))

  const scopeLabel = (token: McpToken) => {
    if (!token.course_ids || token.course_ids.length === 0) return t('token.allCourses')
    if (token.course_ids.length === 1) {
      const title = courseTitleById.get(token.course_ids[0])
      return title ?? t('token.courseCount', { count: 1 })
    }
    return t('token.courseCount', { count: token.course_ids.length })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('description')}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <IconPlus className="size-4 mr-1.5" />
          {t('createToken')}
        </Button>
        <Dialog open={createOpen} onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) resetCreateForm()
        }}>
          <DialogContent className="sm:max-w-lg">
            {revealedToken ? (
              <>
                <DialogHeader>
                  <DialogTitle>{t('revealDialog.title')}</DialogTitle>
                  <DialogDescription>
                    {t('revealDialog.description')}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">{t('revealDialog.pasteLabel')}</Label>
                    <div className="relative">
                      <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto whitespace-pre-wrap">
                        {professorPasteBlock(mcpUrl, revealedToken)}
                      </pre>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(professorPasteBlock(mcpUrl, revealedToken), 'paste')}
                      >
                        {copied === 'paste' ? <IconCheck className="size-3" /> : <IconCopy className="size-3" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{t('revealDialog.pasteHint')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={revealedToken}
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(revealedToken, 'token')}
                    >
                      {copied === 'token' ? <IconCheck className="size-4" /> : <IconCopy className="size-4" />}
                    </Button>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">{t('revealDialog.configLabel')}</Label>
                    <div className="relative">
                      <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">
                        {configSnippet(revealedToken)}
                      </pre>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(configSnippet(revealedToken), 'config')}
                      >
                        {copied === 'config' ? <IconCheck className="size-3" /> : <IconCopy className="size-3" />}
                      </Button>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => setCreateOpen(false)}>{t('revealDialog.done')}</Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>{t('createDialog.title')}</DialogTitle>
                  <DialogDescription>
                    {t('createDialog.description')}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="token-name">{t('createDialog.nameLabel')}</Label>
                    <Input
                      id="token-name"
                      placeholder={t('createDialog.namePlaceholder')}
                      value={tokenName}
                      onChange={(e) => setTokenName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiration">{t('createDialog.expirationLabel')}</Label>
                    <Select value={expiration} onValueChange={(v) => v && setExpiration(v)}>
                      <SelectTrigger id="expiration">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">{t('createDialog.expiration7d')}</SelectItem>
                        <SelectItem value="30">{t('createDialog.expiration30d')}</SelectItem>
                        <SelectItem value="90">{t('createDialog.expiration90d')}</SelectItem>
                        <SelectItem value="never">{t('createDialog.expirationNever')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">{t('createDialog.courseScope')}</legend>
                    <p className="text-xs text-muted-foreground">{t('createDialog.courseScopeHint')}</p>
                    {courses.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('createDialog.noCourses')}</p>
                    ) : (
                      <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                        {courses.map((course) => (
                          <label key={course.course_id} className="flex items-start gap-2 text-sm">
                            <Checkbox
                              checked={courseIds.includes(course.course_id)}
                              onCheckedChange={() => toggleCourse(course.course_id)}
                            />
                            <span>{course.title}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </fieldset>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreate} disabled={isPending}>
                    {isPending ? t('createDialog.creating') : t('createDialog.create')}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <ConnectClaudeCard connectorUrl={connectorUrl} />

      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setShowInstructions(!showInstructions)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">{t('howToConnect.title')}</CardTitle>
              <CardDescription>
                {t('howToConnect.description')}
              </CardDescription>
            </div>
            {showInstructions
              ? <IconChevronUp className="size-4 text-muted-foreground" />
              : <IconChevronDown className="size-4 text-muted-foreground" />
            }
          </div>
        </CardHeader>
        {showInstructions && (
          <CardContent className="text-sm space-y-3">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>{t('howToConnect.step1')}</li>
              <li>{t('howToConnect.step2')}</li>
              <li>{t('howToConnect.step3')}</li>
              <li>{t('howToConnect.step4')}</li>
            </ol>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('yourTokens.title')}</CardTitle>
          <CardDescription>
            {tokens.length === 0
              ? t('yourTokens.empty')
              : tokens.length === 1
                ? t('yourTokens.count', { count: tokens.length })
                : t('yourTokens.countPlural', { count: tokens.length })
            }
          </CardDescription>
        </CardHeader>
        {tokens.length > 0 && (
          <CardContent>
            <div className="divide-y">
              {tokens.map((token) => {
                const expired = isExpired(token.expires_at)
                const inactive = !token.is_active
                return (
                  <div key={token.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{token.name}</span>
                        {inactive && (
                          <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                            {t('token.revoked')}
                          </span>
                        )}
                        {!inactive && expired && (
                          <span className="text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
                            {t('token.expired')}
                          </span>
                        )}
                        {!inactive && !expired && (
                          <span className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded">
                            {t('token.active')}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>{t('token.created', { date: formatDate(token.created_at) })}</span>
                        {token.last_used_at && <span>{t('token.lastUsed', { date: formatDate(token.last_used_at) })}</span>}
                        {token.expires_at && <span>{t('token.expires', { date: formatDate(token.expires_at) })}</span>}
                        <span>{t('token.roleProfessor')}</span>
                        <span>{scopeLabel(token)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {token.is_active && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRevoke(token.id)}
                          disabled={isPending}
                          title={t('actions.revoke')}
                        >
                          <IconBan className="size-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(token.id)}
                        disabled={isPending}
                        title={t('actions.delete')}
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
