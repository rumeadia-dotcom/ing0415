import { ArrowDown, ArrowUp, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui'
import type { ImageMeta } from '@/lib/schemas/registration'
import { getSupabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

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
                <button
                  type="button"
                  onClick={() => onRemove(img.id)}
                  aria-label="삭제"
                  className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-danger hover:text-danger-on-soft"
                >
                  <Trash2 className="h-3 w-3" aria-hidden />
                  삭제
                </button>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function ImagePreview({ path, alt }: { path: string; alt: string }): JSX.Element {
  // Storage bucket 'product-images' 가정. RLS 가 seller_id prefix 강제.
  // debug 모드는 mock 어댑터가 별도 처리. real 모드는 signed URL 발급이 정석이지만,
  // 본 컴포넌트는 우선 public URL 사용 (Phase 3 image-transform 도입 시 변환본으로 교체).
  const supabase = getSupabase()
  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  return (
    <div className="aspect-square overflow-hidden bg-surface-muted">
      <img src={data.publicUrl} alt={alt} className="h-full w-full object-cover" loading="lazy" />
    </div>
  )
}
