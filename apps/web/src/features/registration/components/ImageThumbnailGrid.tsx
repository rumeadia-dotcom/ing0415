import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, ImageOff, Star, Trash2 } from 'lucide-react'
import { Button, Skeleton } from '@/components/ui'
import type { ImageMeta } from '@/lib/schemas/registration'
import { getSupabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'

/** 원본 이미지 버킷 (private). 표시는 signed URL 로만 가능. */
const ORIGINAL_BUCKET = 'product-images-original'
/** signed URL 유효기간(초) — 등록 위저드 1회 세션 안에서 충분. */
const SIGNED_URL_TTL_SEC = 3600

interface ImageThumbnailGridProps {
  images: ImageMeta[]
  onSetMain: (imageId: string) => void
  onRemove: (imageId: string) => void
  onMove: (imageId: string, direction: 'up' | 'down') => void
}

/**
 * 업로드 완료 이미지 그리드 — Studio 룩 (대표 ring accent, footer 별 + 화살표 + 삭제).
 * - 썸네일은 Supabase Storage 의 signed/public URL.
 * - 대표(main) 토글 / 삭제 / 위·아래 이동.
 * - dnd-kit 정식 정렬은 v2.
 */
export function ImageThumbnailGrid({ images, onSetMain, onRemove, onMove }: ImageThumbnailGridProps): JSX.Element {
  return (
    <ul className="grid gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {images.map((img, idx) => {
        const isMain = img.role === 'main'
        return (
          <li
            key={img.id}
            className={cn(
              'overflow-hidden rounded-xl border bg-surface',
              isMain ? 'border-2 border-accent' : 'border-border',
            )}
          >
            <ImagePreview path={img.storagePath} alt={`상품 이미지 ${idx + 1}`} />
            <div className="p-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onSetMain(img.id)}
                  aria-pressed={isMain}
                  aria-label={isMain ? '대표 이미지' : '대표로 설정'}
                  className={cn(
                    'flex items-center gap-1 rounded text-[11px] font-bold',
                    isMain ? 'text-accent' : 'text-text-secondary hover:text-text',
                  )}
                >
                  <Star className={cn('h-3.5 w-3.5', isMain && 'fill-current')} aria-hidden />
                  {isMain ? '메인' : '서브'}
                </button>
                <div className="ml-auto flex items-center gap-0.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 border border-border"
                    aria-label="위로 이동"
                    disabled={idx === 0}
                    onClick={() => onMove(img.id, 'up')}
                  >
                    <ArrowUp className="h-3 w-3" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 border border-border"
                    aria-label="아래로 이동"
                    disabled={idx === images.length - 1}
                    onClick={() => onMove(img.id, 'down')}
                  >
                    <ArrowDown className="h-3 w-3" aria-hidden />
                  </Button>
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-1">
                <span className="font-mono text-[10px] text-text-tertiary">
                  #{idx + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(img.id)}
                  aria-label="삭제"
                  className="ml-auto h-6 gap-1 px-1.5 text-[11px] font-semibold text-danger hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 className="h-3 w-3" aria-hidden />
                  삭제
                </Button>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * 원본 이미지 썸네일. 버킷이 private 이므로 signed URL 을 비동기 발급해 표시한다.
 * (이전 구현은 존재하지 않는 'product-images' 버킷 + getPublicUrl → real 에서 403 깨짐.)
 * mock 모드의 createSignedUrl 은 등록된 blob URL 을 돌려준다 (createMockSupabase).
 */
function ImagePreview({ path, alt }: { path: string; alt: string }): JSX.Element {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    setUrl(null)
    setFailed(false)
    const supabase = getSupabase()
    supabase.storage
      .from(ORIGINAL_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SEC)
      .then(({ data, error }) => {
        if (!active) return
        if (error || !data?.signedUrl) {
          logger.warn({ err: error?.message }, '← image signed URL 발급 실패')
          setFailed(true)
          return
        }
        setUrl(data.signedUrl)
      })
      .catch((e: unknown) => {
        if (!active) return
        logger.warn({ err: e instanceof Error ? e.message : String(e) }, '← image signed URL 예외')
        setFailed(true)
      })
    return () => {
      active = false
    }
  }, [path])

  return (
    <div className="aspect-square overflow-hidden bg-surface-muted">
      {failed ? (
        <div
          role="img"
          aria-label={`${alt} (불러오기 실패)`}
          className="flex h-full w-full flex-col items-center justify-center gap-1 text-text-tertiary"
        >
          <ImageOff className="h-6 w-6" aria-hidden />
          <span className="text-[10px]">불러오기 실패</span>
        </div>
      ) : url ? (
        <img
          src={url}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <Skeleton className="h-full w-full" aria-label={`${alt} 로딩 중`} />
      )}
    </div>
  )
}
