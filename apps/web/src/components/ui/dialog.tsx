import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Dialog — Radix Dialog 래퍼.
 * 데스크탑 모달 기본. 모바일 자동 Sheet 전환은 v1 Phase 2 의 ResponsiveDialog 가 처리 (이 파일은 base 만).
 *
 * 패딩: ui-system.md §5 (header 18 22 / body 20 22 / footer 14 22 / 모바일 좌우 16)
 */
export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogPortal = DialogPrimitive.Portal
export const DialogClose = DialogPrimitive.Close

export const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-50 bg-text/50 backdrop-blur-sm',
        'data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out',
        className,
      )}
      {...props}
    />
  )
})

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(function DialogContent({ className, children, ...props }, ref) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
          'gap-3 bg-surface border border-border shadow-pop',
          'rounded-lg p-5 md:p-[22px]',
          'data-[state=open]:animate-slide-in-from-top data-[state=closed]:animate-fade-out',
          // 모바일: 좌우 margin 16
          'max-md:max-w-[calc(100vw-32px)]',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className={cn(
            'absolute right-3 top-3 rounded-sm',
            'opacity-70 ring-offset-surface transition-opacity hover:opacity-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:pointer-events-none',
          )}
          aria-label="닫기"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col gap-1.5 text-left', className)}
      {...props}
    />
  )
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2 sm:space-x-0',
        className,
      )}
      {...props}
    />
  )
}

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('text-h2 leading-none tracking-tight text-text', className)}
      {...props}
    />
  )
})

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-sm text-text-secondary', className)}
      {...props}
    />
  )
})
