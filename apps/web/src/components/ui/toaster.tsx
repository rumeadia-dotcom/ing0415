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
      toastOptions={{
        unstyled: false,
        classNames: {
          toast: [
            'group toast',
            'group-[.toaster]:bg-white',
            'group-[.toaster]:text-[oklch(0.15_0.015_60)]',
            'group-[.toaster]:border',
            'group-[.toaster]:border-[oklch(0.92_0.008_75)]',
            'group-[.toaster]:border-l-4',
            'group-[.toaster]:border-l-[oklch(0.62_0.14_55)]',
            'group-[.toaster]:rounded-[12px]',
            'group-[.toaster]:shadow-[0_12px_24px_-8px_oklch(0_0_0_/_0.15),0_4px_8px_-2px_oklch(0_0_0_/_0.06)]',
          ].join(' '),
          description: 'group-[.toast]:text-[oklch(0.48_0.012_60)]',
          actionButton: [
            'group-[.toast]:bg-[oklch(0.15_0.015_60)]',
            'group-[.toast]:!text-white',
            'group-[.toast]:rounded-[8px]',
            'group-[.toast]:px-3 group-[.toast]:py-[6px]',
            'group-[.toast]:text-[12.5px] group-[.toast]:font-bold',
          ].join(' '),
          cancelButton: [
            'group-[.toast]:bg-white',
            'group-[.toast]:text-[oklch(0.48_0.012_60)]',
            'group-[.toast]:border group-[.toast]:border-[oklch(0.85_0.01_75)]',
            'group-[.toast]:rounded-[8px]',
            'group-[.toast]:px-3 group-[.toast]:py-[6px]',
            'group-[.toast]:text-[12.5px] group-[.toast]:font-semibold',
          ].join(' '),
          success: 'group-[.toaster]:!border-l-[oklch(0.55_0.10_160)]',
          error: 'group-[.toaster]:!border-l-[oklch(0.55_0.16_25)]',
          warning: 'group-[.toaster]:!border-l-[oklch(0.62_0.12_70)]',
          info: 'group-[.toaster]:!border-l-[oklch(0.55_0.10_235)]',
        },
      }}
      {...props}
    />
  )
}
