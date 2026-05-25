import { useCallback, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

interface ImageDropzoneProps {
  onFilesSelected: (files: File[]) => void
  disabled?: boolean
  remainingSlots: number
}

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

/**
 * 이미지 드롭존 — 드래그 / 클릭 / paste. Studio 룩 (accent 링 + dashed border).
 * - jpg / png / webp 만, 10MB 이하 클라이언트 사전 필터.
 * - remainingSlots 초과분은 잘라냄.
 */
export function ImageDropzone({ onFilesSelected, disabled, remainingSlots }: ImageDropzoneProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const accept = (list: FileList | File[]) => {
    const arr = Array.from(list)
      .filter((f) => ALLOWED.includes(f.type))
      .filter((f) => f.size <= 10 * 1024 * 1024)
      .slice(0, remainingSlots)
    if (arr.length > 0) onFilesSelected(arr)
  }

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragOver(false)
      if (disabled) return
      if (e.dataTransfer?.files) accept(e.dataTransfer.files)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, remainingSlots],
  )

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="이미지 업로드 영역"
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) inputRef.current?.click()
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-sm transition-colors',
        dragOver
          ? 'border-accent bg-accent-soft'
          : 'border-border-strong bg-surface-subtle',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        aria-hidden
        className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-onlight"
      >
        <Plus className="h-6 w-6" strokeWidth={1.5} />
      </span>
      <p className="text-sm font-semibold text-text">여기로 드래그하거나 클릭해 업로드</p>
      <p className="text-xs text-text-tertiary">
        JPG · PNG · WebP · 각 10MB 이하 · 1000×1000 권장 · 최대 {remainingSlots}장 추가 가능
      </p>
      <Button
        type="button"
        size="sm"
        variant="primary"
        className="mt-2"
        onClick={(e) => {
          e.stopPropagation()
          if (!disabled) inputRef.current?.click()
        }}
      >
        파일 선택
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED.join(',')}
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files) accept(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
