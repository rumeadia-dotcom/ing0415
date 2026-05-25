import { useEffect } from 'react'

/**
 * beforeunload 경고 hook.
 *
 * `when` 이 true 일 때 페이지 reload / 탭 닫기 / 다른 사이트로 이동 시 브라우저 기본 경고.
 * 메시지 텍스트는 모든 모던 브라우저가 보안상 무시하고 자체 안내 노출
 * (e.g. Chrome: "Reload site? Changes you made may not be saved.").
 *
 * cycle 37: register wizard 5단계 진행 중 사용자가 실수로 reload 시 입력 손실 안내.
 * useRegisterFormStore 는 in-memory 라 reload 시 step1/images/selections 전부 0.
 *
 * 사용:
 *   useBeforeUnload(form.formState.isDirty)
 *   useBeforeUnload(images.length > 0 || step1 != null)
 */
export function useBeforeUnload(when: boolean): void {
  useEffect(() => {
    if (!when) return
    const handler = (e: BeforeUnloadEvent): void => {
      e.preventDefault()
      // 일부 구형 브라우저는 returnValue 설정 필요. 모던은 e.preventDefault() 만으로 충분.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [when])
}
