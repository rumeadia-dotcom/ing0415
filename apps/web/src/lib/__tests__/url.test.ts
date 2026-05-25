import { describe, expect, it } from 'vitest'
import { buildAppUrl, resolveBasename } from '../url'

describe('resolveBasename', () => {
  it('상대 base 들은 모두 "/" 로 정규화', () => {
    expect(resolveBasename('./')).toBe('/')
    expect(resolveBasename('.')).toBe('/')
    expect(resolveBasename('')).toBe('/')
    expect(resolveBasename(undefined)).toBe('/')
    expect(resolveBasename('/')).toBe('/')
  })

  it('absolute subpath 는 trailing slash 제거', () => {
    expect(resolveBasename('/ing0415/')).toBe('/ing0415')
    expect(resolveBasename('/sub/nested/')).toBe('/sub/nested')
    expect(resolveBasename('/x')).toBe('/x')
  })
})

describe('buildAppUrl', () => {
  const ORIGIN = 'https://rumeadia-dotcom.github.io'

  it('dev / 로컬 (BASE_URL="./") — subpath 없이 직접 결합', () => {
    expect(buildAppUrl(ORIGIN, '/login', './')).toBe(
      'https://rumeadia-dotcom.github.io/login',
    )
  })

  it('운영 (BASE_URL="/ing0415/") — subpath prefix 포함 ⚠ 회귀 가드', () => {
    expect(buildAppUrl(ORIGIN, '/login', '/ing0415/')).toBe(
      'https://rumeadia-dotcom.github.io/ing0415/login',
    )
    expect(buildAppUrl(ORIGIN, '/reset-password', '/ing0415/')).toBe(
      'https://rumeadia-dotcom.github.io/ing0415/reset-password',
    )
  })

  it('routePath 가 "/" 로 시작하지 않으면 throw', () => {
    expect(() => buildAppUrl(ORIGIN, 'login', '/ing0415/')).toThrow(/must start with/)
  })

  it('BASE_URL 미지정 (undefined) → "/" 로 폴백', () => {
    expect(buildAppUrl(ORIGIN, '/login', undefined)).toBe(
      'https://rumeadia-dotcom.github.io/login',
    )
  })
})
