import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui'
import { useAuth, trackAuthEvent } from '@/features/auth'
import { ko } from '@/locales/ko'
import { logger } from '@/lib/logger'

/**
 * SettingsPage — /settings.
 * v1 범위: 계정 카드 (이메일 + 로그아웃) 단일. 알림·테마 영구설정 등은 v2.
 */
export function SettingsPage(): JSX.Element {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSignOut(): Promise<void> {
    setSubmitting(true)
    try {
      void trackAuthEvent({ event: 'auth.logout' })
      await signOut()
      toast.success(ko.settings.account.signOutSuccess)
      navigate('/login', { replace: true })
    } catch (err) {
      logger.error({ err }, 'sign-out failed')
      toast.error(ko.settings.account.signOutError)
      setSubmitting(false)
      setConfirmOpen(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[800px]">
      <PageHeader title={ko.settings.title} subtitle={ko.settings.subtitle} />

      <Card>
        <CardHeader>
          <CardTitle>{ko.settings.account.title}</CardTitle>
          <CardDescription>{ko.settings.account.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr]">
            <dt className="text-sm text-text-secondary">{ko.settings.account.email}</dt>
            <dd className="text-sm text-text break-all">{user?.email ?? '—'}</dd>
          </dl>

          <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-text-secondary">
              {ko.settings.account.signOutDescription}
            </p>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(true)}
              className="sm:shrink-0"
            >
              <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
              {ko.settings.account.signOut}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={(open) => !submitting && setConfirmOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ko.settings.account.signOutConfirmTitle}</DialogTitle>
            <DialogDescription>{ko.settings.account.signOutConfirmBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
            >
              {ko.settings.account.signOutCancel}
            </Button>
            <Button variant="primary" onClick={handleSignOut} disabled={submitting}>
              {submitting
                ? ko.settings.account.signOutSubmitting
                : ko.settings.account.signOut}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SettingsPage
