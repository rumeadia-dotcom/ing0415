import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import {
  Button,
  ErrorMessage,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui'
import { useRegisterFormStore } from '../store/useRegisterFormStore'
import { uploadOneImage } from '../hooks/useImageUpload'
import { ImageDropzone } from '../components/ImageDropzone'
import { ImageThumbnailGrid } from '../components/ImageThumbnailGrid'
import { Step2Schema } from '@/lib/schemas/registration'
import type { ImageMeta } from '@/lib/schemas/registration'
import { ImageApiError } from '../api/image-api'

const MAX_IMAGES = 10

/**
 * StepImagesPage — n18 이미지 업로드 (2/5). Studio 룩.
 * 마스터: docs/architecture/v1/features/registration.md §10.4
 *
 * - 드롭존 → uploadOneImage (signed URL → PUT → register) → store.images push
 * - 진행률 카드 (info-soft 톤) + 전체 % 표시
 * - 대표(main) 토글 / 삭제 / 순서 변경 (ImageThumbnailGrid)
 * - "다음" 활성 조건: Step2Schema.parse 성공 (1~10장 + main 1장)
 */

interface UploadingItem {
  id: string
  filename: string
  loaded: number
  total: number
  error: string | null
}

export function StepImagesPage(): JSX.Element {
  const navigate = useNavigate()
  const productId = useRegisterFormStore((s) => s.productId)
  const images = useRegisterFormStore((s) => s.images)
  const setImages = useRegisterFormStore((s) => s.setImages)
  const [uploading, setUploading] = useState<UploadingItem[]>([])
  const [pageError, setPageError] = useState<string | null>(null)
  // unmount 후 진행 중인 setTimeout 의 setState 호출 차단 (memory leak warning 방지).
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // productId 없으면 Step 1 으로 회귀
  useEffect(() => {
    if (!productId) navigate('/register/info', { replace: true })
  }, [productId, navigate])

  if (!productId) return <></>

  const remainingSlots = MAX_IMAGES - images.length - uploading.length

  const handleFiles = async (files: File[]): Promise<void> => {
    setPageError(null)
    const items: UploadingItem[] = files.map((f) => ({
      id: crypto.randomUUID(),
      filename: f.name,
      loaded: 0,
      total: f.size,
      error: null,
    }))
    setUploading((prev) => [...prev, ...items])

    await Promise.all(
      files.map(async (file, idx) => {
        const item = items[idx]
        if (!item) return
        try {
          const baseCount = useRegisterFormStore.getState().images.length
          const meta = await uploadOneImage({
            productId,
            file,
            position: baseCount + idx,
            onProgress: (loaded, total) =>
              setUploading((prev) =>
                prev.map((u) => (u.id === item.id ? { ...u, loaded, total } : u)),
              ),
          })
          const current = useRegisterFormStore.getState().images
          const isFirst = current.length === 0
          const finalMeta: ImageMeta = { ...meta, role: isFirst ? 'main' : 'sub' }
          setImages([...current, finalMeta])
        } catch (err) {
          const msg =
            err instanceof ImageApiError ? err.message : '업로드 중 오류가 발생했습니다.'
          setUploading((prev) => prev.map((u) => (u.id === item.id ? { ...u, error: msg } : u)))
          toast.error(`${file.name} 업로드 실패: ${msg}`)
        } finally {
          setTimeout(() => {
            if (mountedRef.current) {
              setUploading((prev) => prev.filter((u) => u.id !== item.id))
            }
          }, 1500)
        }
      }),
    )
  }

  const handleSetMain = (imageId: string): void => {
    setImages(images.map((img) => ({ ...img, role: img.id === imageId ? 'main' : 'sub' })))
  }

  const handleRemove = (imageId: string): void => {
    const next = images.filter((img) => img.id !== imageId)
    if (next.length > 0 && !next.some((i) => i.role === 'main')) {
      next[0] = { ...(next[0] as ImageMeta), role: 'main' }
    }
    setImages(next.map((img, i) => ({ ...img, sortOrder: i })))
  }

  const handleMove = (imageId: string, direction: 'up' | 'down'): void => {
    const idx = images.findIndex((i) => i.id === imageId)
    if (idx < 0) return
    const target = direction === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= images.length) return
    const next = [...images]
    const a = next[idx]
    const b = next[target]
    if (!a || !b) return
    next[idx] = b
    next[target] = a
    setImages(next.map((img, i) => ({ ...img, sortOrder: i })))
  }

  const handleNext = (): void => {
    const parsed = Step2Schema.safeParse({ images })
    if (!parsed.success) {
      setPageError(parsed.error.issues[0]?.message ?? '이미지를 확인해 주세요.')
      return
    }
    navigate('/register/markets')
  }

  const blockingReasons: string[] = []
  if (images.length === 0) blockingReasons.push('1장 이상 업로드 필요')
  if (images.length > 0 && !images.some((i) => i.role === 'main')) blockingReasons.push('대표 이미지 1장 지정 필요')
  if (uploading.length > 0) blockingReasons.push('업로드 진행 중')

  return (
    <>
      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <header className="mb-4">
          <h2 className="text-[15px] font-bold text-text">상품 이미지</h2>
          <p className="mt-1 text-[12.5px] text-text-tertiary">
            1~10장, 대표 1장 필수. 마켓별 규격은 업로드 후 자동 최적화돼요.
          </p>
        </header>

        {remainingSlots > 0 ? (
          <ImageDropzone onFilesSelected={handleFiles} remainingSlots={remainingSlots} />
        ) : (
          <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning-on-soft">
            최대 {MAX_IMAGES}장까지 업로드 가능합니다. 기존 이미지를 삭제 후 추가해 주세요.
          </p>
        )}

        {uploading.length > 0 && (
          <ul className="mt-4 space-y-2">
            {uploading.map((u) => {
              const pct = Math.round((u.loaded / Math.max(u.total, 1)) * 100)
              return (
                <li
                  key={u.id}
                  className="flex items-center gap-3 rounded-md bg-info-soft px-3.5 py-2.5 text-sm text-info-on-soft"
                >
                  <span
                    aria-hidden
                    className="inline-flex h-6 w-6 items-center justify-center rounded bg-info-on-soft/80 text-white"
                  >
                    <Upload className="h-3 w-3" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12.5px] font-medium">
                        {u.filename}
                      </span>
                      <span className="font-mono text-[11.5px]">
                        {u.error ? '실패' : `${pct}%`}
                      </span>
                    </div>
                    {!u.error && (
                      <div className="mt-1 h-1 w-full overflow-hidden rounded bg-white/60">
                        <div
                          className="h-full bg-info-on-soft transition-all"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    )}
                    {u.error && (
                      <p className="mt-1 text-[11.5px] text-danger-on-soft">{u.error}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {images.length > 0 && (
          <div className="mt-5">
            <div className="mb-2.5 flex items-baseline justify-between">
              <h3 className="text-[13.5px] font-bold text-text">
                업로드된 이미지 {images.length}장
              </h3>
              <span className="text-[11.5px] text-text-tertiary">
                별표로 대표 지정 · 화살표로 순서 변경
              </span>
            </div>
            <ImageThumbnailGrid
              images={images}
              onSetMain={handleSetMain}
              onRemove={handleRemove}
              onMove={handleMove}
            />
          </div>
        )}

        {pageError && (
          <div className="mt-4">
            <ErrorMessage message={pageError} />
          </div>
        )}
      </section>

      {/* Action bar */}
      <div className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-surface px-5 py-3 shadow-sm">
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate('/register/info')}
          className="border border-border"
        >
          ← 상품 정보
        </Button>
        <div className="flex-1 text-[12.5px] text-text-tertiary">
          {blockingReasons.length > 0
            ? blockingReasons[0]
            : `이미지 ${images.length}장 · 대표 지정 완료`}
        </div>
        {blockingReasons.length > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="primary" disabled aria-disabled>
                  다음: 마켓 선택 →
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <ul className="space-y-0.5 text-xs">
                {blockingReasons.map((r) => (
                  <li key={r}>· {r}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button variant="primary" onClick={handleNext}>
            다음: 마켓 선택 →
          </Button>
        )}
      </div>
    </>
  )
}

export default StepImagesPage
