import { Toaster as SonnerToaster, type ToasterProps } from 'sonner'

/**
 * Toaster — sonner 래퍼.
 * ui-system.md §7 — `default` / `success` / `error` / `loading`.
 * 자동 dismiss 5s, error 는 수동 dismiss.
 *
 * 색상은 토큰 클래스로 매핑 (raw HEX 금지 룰).
 * 다크 모드는 상위 [data-theme="dark"] 에 따라 자동 전환되도록 theme='system' 대신 토큰 클래스 기반 unstyled 적용.
 */
export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      position="top-right"
      duration={5000}
      closeButton
      // theme='system' 으로 두면 sonner 가 자체 prefers 감지 — 우리는 data-theme 토글이라 강제로 'light' 두고 클래스 매핑
      // 다크 모드에서도 toastOptions classNames 가 토큰 클래스를 통해 자연 전환됨
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-surface group-[.toaster]:text-text group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-text-secondary',
          actionButton:
            'group-[.toast]:bg-accent group-[.toast]:text-white group-[.toast]:rounded-md group-[.toast]:px-2.5 group-[.toast]:py-1 group-[.toast]:text-button',
          cancelButton:
            'group-[.toast]:bg-surface-muted group-[.toast]:text-text-secondary group-[.toast]:rounded-md group-[.toast]:px-2.5 group-[.toast]:py-1 group-[.toast]:text-button',
          success:
            'group-[.toaster]:!bg-success-soft group-[.toaster]:!text-success-on-soft group-[.toaster]:!border-success/30',
          error:
            'group-[.toaster]:!bg-danger-soft group-[.toaster]:!text-danger-on-soft group-[.toaster]:!border-danger/30',
          warning:
            'group-[.toaster]:!bg-warning-soft group-[.toaster]:!text-warning-on-soft group-[.toaster]:!border-warning/30',
          info: 'group-[.toaster]:!bg-info-soft group-[.toaster]:!text-info-on-soft group-[.toaster]:!border-accent/30',
        },
      }}
      {...props}
    />
  )
}
