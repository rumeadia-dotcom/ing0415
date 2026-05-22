/**
 * Daum (카카오) Postcode SDK 동적 로더.
 *
 * - API 키 / 결제 / 도메인 등록 불필요 (무료 공개 SDK).
 * - script 는 한 번만 로드하고 캐시한다.
 * - SSR 환경 보호: window 가 없으면 reject.
 *
 * Docs: https://postcode.map.daum.net/guide
 */

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: DaumPostcodeOptions) => { open: () => void }
    }
  }
}

export interface DaumPostcodeData {
  zonecode: string
  address: string
  addressEnglish: string
  addressType: 'R' | 'J'
  bname: string
  buildingName: string
  apartment: 'Y' | 'N'
  jibunAddress: string
  roadAddress: string
  sido: string
  sigungu: string
  sigunguCode: string
  userSelectedType: 'R' | 'J'
  userLanguageType: 'K' | 'E'
}

interface DaumPostcodeOptions {
  oncomplete: (data: DaumPostcodeData) => void
  onclose?: (state: 'FORCE_CLOSE' | 'COMPLETE_CLOSE') => void
  width?: string | number
  height?: string | number
}

const SCRIPT_SRC =
  'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'

let loadPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Daum Postcode 는 브라우저 환경에서만 사용할 수 있습니다'))
  }
  if (window.daum?.Postcode) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    )
    const onLoad = (): void => {
      if (window.daum?.Postcode) resolve()
      else reject(new Error('Daum Postcode 스크립트 로드 실패'))
    }
    const onError = (): void => {
      loadPromise = null
      reject(new Error('Daum Postcode 스크립트를 불러올 수 없습니다 (네트워크 확인)'))
    }
    if (existing) {
      existing.addEventListener('load', onLoad, { once: true })
      existing.addEventListener('error', onError, { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })
    document.head.appendChild(script)
  })
  return loadPromise
}

/**
 * Daum Postcode 팝업을 띄우고 사용자가 선택한 주소를 resolve.
 * 사용자가 닫기로 종료하면 null resolve.
 */
export async function openPostcodePopup(): Promise<DaumPostcodeData | null> {
  await loadScript()
  const Postcode = window.daum?.Postcode
  if (!Postcode) {
    throw new Error('Daum Postcode SDK 를 사용할 수 없습니다')
  }

  return new Promise<DaumPostcodeData | null>((resolve) => {
    let completed = false
    const instance = new Postcode({
      oncomplete: (data) => {
        completed = true
        resolve(data)
      },
      onclose: (state) => {
        if (!completed && state === 'FORCE_CLOSE') resolve(null)
      },
    })
    instance.open()
  })
}

/**
 * Daum 결과를 단일 문자열로 정형화.
 *  포맷: "[12345] 도로명주소 상세주소"
 *  도로명이 비어있으면 jibunAddress fallback.
 */
export function formatPostcodeAddress(
  data: DaumPostcodeData,
  detail: string = '',
): string {
  const base = data.roadAddress || data.jibunAddress || data.address
  const detailTrim = detail.trim()
  const head = data.zonecode ? `[${data.zonecode}] ` : ''
  const tail = detailTrim ? ` ${detailTrim}` : ''
  return `${head}${base}${tail}`.trim()
}
