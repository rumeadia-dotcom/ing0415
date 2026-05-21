import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Mail, User2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Button,
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
import { cn } from '@/lib/utils'
import { SettingsNav } from '../components/SettingsNav'

/**
 * SettingsPage — /settings.
 *
 * 마스터: docs/design-renewal/s9-settings.md §3
 *        docs/design-renewal/designFile/concepts/studio-domains.jsx StudioSettings
 *
 * v1 범위: 계정 카드 (이메일 + 로그아웃) 단일 + Studio 룩 inner nav.
 * 알림·테마 영구설정 / 비밀번호 변경 / 2FA / 청구 / 팀 / 개발자 → v2 (nav 에 placeholder 만).
 *
 * 레이아웃:
 *  - 데스크탑(md+): 좌측 220px inner nav + 우측 카드 컬럼 (max 720px)
 *  - 모바일(<md): inner nav = 가로 chip strip → 본문 카드 세로 스택, 모든 터치 타겟 ≥44px
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

  const email = user?.email ?? '—'
  const initial = email && email !== '—' ? email[0]?.toUpperCase() ?? '·' : '·'

  return (
    <div className="mx-auto w-full max-w-[1080px]">
      <PageHeader title={ko.settings.title} subtitle={ko.settings.subtitle} />

      <div
        className={cn(
          'grid grid-cols-1 gap-6',
          // 데스크탑: 220px nav + 본문
          'md:grid-cols-[220px_minmax(0,1fr)] md:gap-8',
        )}
      >
        <aside>
          <SettingsNav active="account" />
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          {/* 계정 카드 */}
          <section
            aria-labelledby="settings-account-heading"
            className={cn(
              'rounded-lg border border-border bg-surface p-5 md:p-6',
              'shadow-sm',
            )}
          >
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-6">
              {/* Avatar (80×80) — 이메일 첫글자 placeholder. v2 에서 사용자 이미지 업로드로 교체 */}
              <div
                aria-hidden="true"
                className={cn(
                  'flex h-20 w-20 shrink-0 items-center justify-center',
                  'rounded-full bg-brand-grad-soft text-2xl font-bold text-text',
                  'border border-border',
                )}
              >
                {initial}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="settings-account-heading"
                    className="text-h2 text-text"
                  >
                    {ko.settings.account.title}
                  </h2>
                </div>
                <p className="mt-1 text-sm text-text-secondary">
                  {ko.settings.account.description}
                </p>

                <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                  <dt className="flex items-center gap-1.5 text-xs font-semibold text-text-tertiary">
                    <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                    {ko.settings.account.email}
                  </dt>
                  <dd
                    className={cn(
                      'min-w-0 break-all font-mono text-sm text-text',
                    )}
                  >
                    {email}
                  </dd>
                </dl>
              </div>
            </div>

            <div
              className={cn(
                'mt-6 flex flex-col gap-3 border-t border-border pt-5',
                'sm:flex-row sm:items-center sm:justify-between',
              )}
            >
              <p className="text-sm text-text-secondary">
                {ko.settings.account.signOutDescription}
              </p>
              <Button
                variant="outline"
                onClick={() => setConfirmOpen(true)}
                className="min-h-[44px] w-full sm:w-auto sm:shrink-0"
              >
                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                {ko.settings.account.signOut}
              </Button>
            </div>
          </section>

          {/* v2 placeholder — 프로필 / 알림 / 보안 / 청구 / 팀 / 개발자 통합 안내 */}
          <section
            aria-labelledby="settings-v2-heading"
            className={cn(
              'rounded-lg border border-dashed border-border-strong bg-surface-subtle p-5 md:p-6',
            )}
          >
            <div className="flex items-start gap-3">
              <div
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface text-text-tertiary"
              >
                <User2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  id="settings-v2-heading"
                  className="text-sm font-bold text-text"
                >
                  추가 설정은 v2에서 만나요
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  알림 채널(이메일·앱 푸시), 비밀번호 변경, 2FA, 청구, 팀, 개발자 도구는 v2 로
                  순차 제공돼요.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

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
