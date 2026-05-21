import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Sheet — Studio 룩 (디자인 리뉴얼 PR2).
 *
 * - card surface (white) + border oklch(0.92 0.008 75) + radius 16 (모서리는 화면 가장자리만 둥글게)
 * - backdrop oklch(0 0 0 / 0.4)
 * - soft shadow on open side
 *
 * Radix Dialog 를 응용한 변형 (overlay + portal 동일). 모바일 햄버거 메뉴, 우측 상세 패널 등에 사용.
 * Dialog 가 중앙 모달이라면, Sheet 는 화면 가장자리에서 슬라이드.
 */
export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetPortal = DialogPrimitive.Portal
export const SheetClose = DialogPrimitive.Close

const SheetOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function SheetOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm',
        'data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out',
        className,
      )}
      {...props}
    />
  )
})

const sheetVariants = cva(
  [
    'fixed z-50 gap-3 bg-white',
    'border-border',
    'shadow-[0_24px_48px_-12px_oklch(0_0_0_/_0.18)]',
    'data-[state=open]:animate-slide-in-from-top data-[state=closed]:animate-fade-out',
  ],
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 border-b rounded-b-[16px]',
        bottom: 'inset-x-0 bottom-0 border-t rounded-t-[16px]',
        left: 'inset-y-0 left-0 h-full w-3/4 max-w-sm border-r rounded-r-[16px]',
        right: 'inset-y-0 right-0 h-full w-3/4 max-w-sm border-l rounded-l-[16px]',
      },
    },
    defaultVariants: {
      side: 'right',
    },
  },
)

export interface SheetContentProps
  extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

export const SheetContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(function SheetContent({ side = 'right', className, children, ...props }, ref) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(sheetVariants({ side }), 'p-[22px]', className)}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className={cn(
            'absolute right-3 top-3 rounded-sm text-dim',
            'opacity-70 transition-opacity hover:opacity-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
            'disabled:pointer-events-none',
          )}
          aria-label="닫기"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </SheetPortal>
  )
})

export function SheetHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 text-left', className)} {...props} />
}

export function SheetFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-auto flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

export const SheetTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function SheetTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn(
        'text-[20px] font-bold leading-tight tracking-tight text-ink',
        className,
      )}
      {...props}
    />
  )
})

export const SheetDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function SheetDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-[13px] text-dim', className)}
      {...props}
    />
  )
})
