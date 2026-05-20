import { ArrowDown, ArrowUp, Trash2, Star } from 'lucide-react'
import { Button } from '@/components/ui'
import type { ImageMeta } from '@/lib/schemas/registration'
import { getSupabase } from '@/lib/supabase'

interface ImageThumbnailGridProps {
  images: ImageMeta[]
  onSetMain: (imageId: string) => void
  onRemove: (imageId: string) => void
  onMove: (imageId: string, direction: 'up' | 'down') => void
}

/**
 * 업로드 완료 이미지 그리드.
 * - 썸네일은 Supabase Storage 의 signed/public URL.
 * - 대표(main) 토글 / 삭제 / 위·아래 이동.
 * - dnd-kit 정식 정렬은 v2 (B-4 MVP 는 화살표).
 */
export function ImageThumbnailGrid({ images, onSetMain, onRemove, onMove }: ImageThumbnailGridProps): JSX.Element {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {images.map((img, idx) => (
        <li key={img.id} className="relative overflow-hidden rounded-lg border border-border bg-surface">
          <ImagePreview path={img.storagePath} alt={`상품 이미지 ${idx + 1}`} />
          <div className="flex items-center justify-between p-2">
            <Button
              type="button"
              size="sm"
              variant={img.role === 'main' ? 'primary' : 'secondary'}
              onClick={() => onSetMain(img.id)}
              aria-pressed={img.role === 'main'}
            >
              <Star className="h-3.5 w-3.5" aria-hidden />
              {img.role === 'main' ? '대표' : '대표로'}
            </Button>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="위로 이동"
                disabled={idx === 0}
                onClick={() => onMove(img.id, 'up')}
              >
                <ArrowUp className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="아래로 이동"
                disabled={idx === images.length - 1}
                onClick={() => onMove(img.id, 'down')}
              >
                <ArrowDown className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="삭제"
                onClick={() => onRemove(img.id)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        </li>
      ))}
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
