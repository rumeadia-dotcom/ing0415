import { ko } from '@/locales/ko'

interface ProviderGuideCardProps {
  title: string
  steps: readonly string[]
}

/**
 * 발급 가이드 사이드 패널 — Studio s5 connect (StudioMarketConnect aside).
 * 단계 번호 + 절차 텍스트. accent-soft 배경의 동그란 step badge.
 */
export function ProviderGuideCard({ title, steps }: ProviderGuideCardProps): JSX.Element {
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
