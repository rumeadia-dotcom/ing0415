import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@/components/ui'
import { MARKET_CATALOG, MARKET_IDS, type MarketId } from '../types'

/**
 * MarketsConnectProviderPage — n37 (provider 별 4-way 인증 폼 분기).
 *
 * Wave 3 (2026-05-19 5마켓 MVP 확장):
 *  - naver   → OAuth 안내 + [네이버에서 인증] (Stage D 에서 markets-oauth-start 호출)
 *  - coupang → HMAC 키 입력 폼 (accessKey / secretKey / vendorId)
 *  - gmarket → ESM JWT 폼 (masterId / secretKey / sellerId, site='G' 자동)
 *  - auction → ESM JWT 폼 (masterId / secretKey / sellerId, site='A' 자동)
 *  - 11st    → disabled 안내
 *
 * 현재 Stage 는 폼 마크업 placeholder. 실 mutation 은 Wave 4+ (markets-connect Edge Function).
 */
function isMarketId(value: string | undefined): value is MarketId {
  return typeof value === 'string' && (MARKET_IDS as readonly string[]).includes(value)
}

export function MarketsConnectProviderPage(): JSX.Element {
  const { provider } = useParams<{ provider: string }>()
  if (!isMarketId(provider)) {
    return (
      <div className="mx-auto w-full max-w-[640px]">
        <PageHeader title="알 수 없는 마켓" subtitle="유효하지 않은 provider 입니다." />
        <Card>
          <CardContent>
            <Button asChild variant="ghost">
              <Link to="/markets/connect">마켓 선택으로</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const entry = MARKET_CATALOG[provider]
  const label = entry.label

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <PageHeader title={`${label} 연결`} subtitle={authSubtitle(entry.authMode)} />
      {entry.authMode === 'oauth' && <OAuthSection label={label} />}
      {entry.authMode === 'hmac' && <HmacSection label={label} />}
      {entry.authMode === 'esm_jwt' && (
        <EsmJwtSection label={label} site={provider === 'gmarket' ? 'G' : 'A'} />
      )}
      {entry.authMode === 'disabled' && <DisabledSection label={label} />}
    </div>
  )
}

function authSubtitle(mode: (typeof MARKET_CATALOG)[MarketId]['authMode']): string {
  switch (mode) {
    case 'oauth':
      return 'OAuth 2.0 인증으로 마켓 계정을 안전하게 연결합니다.'
    case 'hmac':
      return 'API 키(Access / Secret / Vendor ID) 를 입력해 연결합니다.'
    case 'esm_jwt':
      return 'ESM 인증 키(Master ID / Secret / Seller ID) 를 입력해 연결합니다.'
    case 'disabled':
      return '현재 오픈 준비중인 마켓입니다.'
  }
}

function OAuthSection({ label }: { label: string }): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>OAuth 인증</CardTitle>
        <CardDescription>
          버튼을 누르면 {label} 인증 화면으로 이동합니다. 마켓 로그인 정보는
          MarketCast 에 전달되지 않으며, 발급된 토큰은 암호화 저장됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button asChild variant="ghost">
          <Link to="/markets/connect">취소</Link>
        </Button>
        <Button disabled aria-disabled>
          {label} 에서 인증 (Stage D)
        </Button>
      </CardContent>
    </Card>
  )
}

function HmacSection({ label }: { label: string }): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label} HMAC 키 입력</CardTitle>
        <CardDescription>
          쿠팡 윙(Wing) → 개발자 메뉴 → API Key 발급 화면에서 받은 3개 값을 입력하세요.
          입력값은 Edge Function 만 접근 가능한 영역에 암호화 저장됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
          <div className="flex flex-col gap-1">
            <label htmlFor="hmac-accessKey" className="text-sm font-medium">
              Access Key
            </label>
            <Input
              id="hmac-accessKey"
              name="accessKey"
              type="text"
              required
              autoComplete="off"
              placeholder="예: aaaa-bbbb-cccc-dddd"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="hmac-secretKey" className="text-sm font-medium">
              Secret Key
            </label>
            <Input
              id="hmac-secretKey"
              name="secretKey"
              type="password"
              required
              autoComplete="off"
              placeholder="40자 이상의 영문 + 숫자"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="hmac-vendorId" className="text-sm font-medium">
              Vendor ID
            </label>
            <Input
              id="hmac-vendorId"
              name="vendorId"
              type="text"
              required
              autoComplete="off"
              placeholder="예: A00012345"
            />
          </div>
          <div className="mt-2 flex gap-2">
            <Button asChild variant="ghost" type="button">
              <Link to="/markets/connect">취소</Link>
            </Button>
            <Button type="submit" disabled aria-disabled>
              연결 (Stage D)
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function EsmJwtSection({ label, site }: { label: string; site: 'G' | 'A' }): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label} ESM 키 입력</CardTitle>
        <CardDescription>
          ESM Plus → 판매자 도구 → API 관리에서 받은 3개 값을 입력하세요. site
          코드는 자동으로 <code>{site}</code> 로 설정됩니다 ({label} 전용).
          입력값은 암호화 저장됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
          <input type="hidden" name="site" value={site} />
          <div className="flex flex-col gap-1">
            <label htmlFor="esm-masterId" className="text-sm font-medium">
              Master ID
            </label>
            <Input
              id="esm-masterId"
              name="masterId"
              type="text"
              required
              autoComplete="off"
              placeholder="ESM 통합 마스터 ID"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="esm-secretKey" className="text-sm font-medium">
              Secret Key
            </label>
            <Input
              id="esm-secretKey"
              name="secretKey"
              type="password"
              required
              autoComplete="off"
              placeholder="ESM 발급 시크릿"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="esm-sellerId" className="text-sm font-medium">
              Seller ID
            </label>
            <Input
              id="esm-sellerId"
              name="sellerId"
              type="text"
              required
              autoComplete="off"
              placeholder={`${label} 셀러 ID`}
            />
          </div>
          <div className="mt-2 flex gap-2">
            <Button asChild variant="ghost" type="button">
              <Link to="/markets/connect">취소</Link>
            </Button>
            <Button type="submit" disabled aria-disabled>
              연결 (Stage D)
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function DisabledSection({ label }: { label: string }): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label} — 오픈 준비중</CardTitle>
        <CardDescription>
          {label} 연동은 v2 에 제공될 예정입니다. 현재는 활성 4개 마켓 (네이버 ·
          쿠팡 · G마켓 · 옥션) 만 연결 가능합니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="ghost">
          <Link to="/markets/connect">마켓 선택으로</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export default MarketsConnectProviderPage
