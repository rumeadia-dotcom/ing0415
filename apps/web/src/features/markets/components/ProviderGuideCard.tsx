import { ExternalLink } from 'lucide-react'
import { ko } from '@/locales/ko'

interface ProviderGuideCardProps {
  title: string
  steps: readonly string[]
  docUrl?: string
  docLabel?: string
}

/**
 * 발급 가이드 사이드 패널 — Studio s5 connect (StudioMarketConnect aside).
 * 단계 번호 + 절차 텍스트. accent-soft 배경의 동그란 step badge.
 * docUrl 이 있으면 하단에 API 콘솔 외부 링크 버튼을 노출한다.
 */
export function ProviderGuideCard({ title, steps, docUrl, docLabel }: ProviderGuideCardProps): JSX.Element {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-3 text-sm font-bold text-text">{title}</h3>
      <ol className="flex flex-col gap-2.5">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-2.5 text-[12.5px] text-text-secondary">
            <span
              aria-hidden
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-bold text-accent"
            >
              {i + 1}
            </span>
            <span className="leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>
      {docUrl && (
        <a
          href={docUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {docLabel ?? ko.markets.form.docLinkFallback}
          <span className="sr-only">(새 창에서 열림)</span>
        </a>
      )}
    </section>
  )
}

export function ProviderSecurityNote(): JSX.Element {
  return (
    <section
      role="note"
      aria-label="security"
      className="rounded-xl border border-[color:rgb(var(--warning)/0.25)] bg-warning-soft p-3.5 text-[12px] leading-relaxed text-warning-on-soft"
    >
      <strong className="block text-[12.5px] font-bold">보안 주의</strong>
      <span className="mt-1 block opacity-90">{ko.markets.form.securityWarn}</span>
    </section>
  )
}
