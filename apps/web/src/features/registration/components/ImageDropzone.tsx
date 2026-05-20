import { useCallback, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImageDropzoneProps {
  onFilesSelected: (files: File[]) => void
  disabled?: boolean
  remainingSlots: number
}

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

/**
 * 이미지 드롭존 — 드래그 / 클릭 / paste.
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
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-sm transition-colors',
        dragOver ? 'border-accent bg-accent-soft' : 'border-border bg-surface-muted',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <Upload className="h-6 w-6 text-text-secondary" aria-hidden />
      <p className="font-medium text-text">이미지를 끌어 놓거나 클릭해서 선택</p>
      <p className="text-xs text-text-tertiary">
        jpg / png / webp · 10MB 이하 · 최대 {remainingSlots}장 추가 가능
      </p>
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
