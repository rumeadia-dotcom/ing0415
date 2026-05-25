import { Toaster as SonnerToaster, type ToasterProps } from 'sonner'

/**
 * Toaster — Studio 룩 (디자인 리뉴얼 PR2).
 *
 * Studio spec:
 *  - card surface (white) + border oklch(0.92 0.008 75)
 *  - border-left 4px 시맨틱 색 (level 별):
 *    - success: oklch(0.55 0.10 160) (ok)
 *    - warning: oklch(0.62 0.12 70)  (warn)
 *    - error  : oklch(0.55 0.16 25)  (danger)
 *    - info / default: oklch(0.62 0.14 55) (accent)
 *
 * 자동 dismiss 5s, error 는 수동 dismiss 권장 (사용처에서 duration: Infinity 지정).
 */
export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      position="top-right"
      duration={5000}
      closeButton
      // 한국어 aria-label — 기본값 'Notifications alt+T' 는 SR 사용자에게 영어로 노출됨
      containerAriaLabel="알림"
      toastOptions={{
        unstyled: false,
        classNames: {
          toast: [
            'group toast',
            'group-[.toaster]:bg-white',
            'group-[.toaster]:text-ink',
            'group-[.toaster]:border',
            'group-[.toaster]:border-border',
            'group-[.toaster]:border-l-4',
            'group-[.toaster]:border-l-accent',
            'group-[.toaster]:rounded-[12px]',
            'group-[.toaster]:shadow-[0_12px_24px_-8px_oklch(0_0_0_/_0.15),0_4px_8px_-2px_oklch(0_0_0_/_0.06)]',
          ].join(' '),
          description: 'group-[.toast]:text-dim',
          actionButton: [
            'group-[.toast]:bg-ink',
            'group-[.toast]:!text-white',
            'group-[.toast]:rounded-[8px]',
            'group-[.toast]:px-3 group-[.toast]:py-[6px]',
            'group-[.toast]:text-[12.5px] group-[.toast]:font-bold',
          ].join(' '),
          cancelButton: [
            'group-[.toast]:bg-white',
            'group-[.toast]:text-dim',
            'group-[.toast]:border group-[.toast]:border-border-strong',
            'group-[.toast]:rounded-[8px]',
            'group-[.toast]:px-3 group-[.toast]:py-[6px]',
            'group-[.toast]:text-[12.5px] group-[.toast]:font-semibold',
          ].join(' '),
          success: 'group-[.toaster]:!border-l-success',
          error: 'group-[.toaster]:!border-l-danger',
          warning: 'group-[.toaster]:!border-l-warning',
          info: 'group-[.toaster]:!border-l-info',
        },
      }}
      {...props}
    />
  )
}
