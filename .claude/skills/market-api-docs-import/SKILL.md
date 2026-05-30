---
name: market-api-docs-import
description: 마켓·택배사 OpenAPI 공식 문서 사이트를 통째로 fetch 해서 프로젝트의 영구 설계 디렉토리에 마크다운으로 인덱스+상세 변환하는 워크플로우. 사용자가 "쿠팡 API 문서 정리", "네이버 OpenAPI docs 가져와", "11번가 API 문서", "G마켓/옥션 ESM API 문서", "로젠 API 문서", "마켓 API docs 다운로드", "Zendesk Help Center 문서 변환" 이라고 말하거나, 새 마켓 어댑터 (네이버/11번가/G마켓/옥션/쿠팡) 또는 택배사(로젠 등) 연동 구현 직전·기존 어댑터 회귀 검토 시 docs 가 stale 한 시점에 트리거. 사이트 유형(Zendesk Help Center / 정적 HTML+JS nav / Tistory 블로그 등)을 먼저 판별한 뒤 해당 전략으로 변환. 일회성 외부 fetch 가 아닌, 프로젝트 영구 산출물로 박는 절차.
---

# 마켓 / 택배사 API 문서 import 스킬

쿠팡·네이버·11번가·G마켓·옥션 등 마켓과 로젠 등 택배사의 공식 OpenAPI 문서 사이트를 분석해서 article 단위 마크다운으로 변환·인덱싱한다. 어댑터 (`apps/api/supabase/functions/_shared/markets/<market>/*`) 구현 시 매번 외부 사이트 조회 없이 grep / Read 로 spec 참조 가능하게 만드는 게 목적.

docs 사이트는 벤더마다 구조가 다르다. **먼저 사이트 유형을 판별**(아래 라우터)하고, 그에 맞는 **전략 섹션**을 따른다. 새 유형이면 전략 레시피를 추가한다 (범위 밖으로 거부하지 않는다).

---

## 사이트 유형 판별 (라우터 — 항상 먼저)

```
1. 사이트 root 가 /hc/<locale> 형태이고
   /api/v2/help_center/<locale>/categories.json 호출 시 JSON 반환?
   → ✅ 전략 A (Zendesk Help Center)

2. 일반 .html 페이지인데 본문(.content-box 등)이 서버 렌더 HTML 로 들어있고,
   좌측 nav 가 별도 JS 파일(menuData.js 등)에서 주입되며,
   요청/응답 예시가 별도 JSON(exampleData.json 등)으로 분리?
   → ✅ 전략 B (정적 HTML + JS nav)

3. Tistory 블로그(<title>TISTORY</title>, 글 1개=API 1개, URL=/숫자,
   카테고리=/category/<name>, 본문=.entry-content, 제목=og:title)?
   → ✅ 전략 C (Tistory 블로그)

4. SPA(본문이 JS 렌더, HTML 에 내용 없음) / OpenAPI(Swagger·Redoc) spec json /
   GitBook / Docusaurus / 기타?
   → 🆕 신규 전략. 아래 "신규 전략 추가" 절차로 레시피를 만든 뒤 진행.
```

판별 명령 (curl 로 빠르게):

```bash
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
# Zendesk 여부
curl -sS -A "$UA" "https://<host>/api/v2/help_center/ko/categories.json" | jq '.categories | length' 2>/dev/null
# 정적 HTML 여부 — 본문이 응답에 직접 있는지
curl -sS -A "$UA" "https://<host>/.../page.html" | grep -c 'content-box\|<table' 
# nav JS / example JS 후보 탐색
curl -sS -A "$UA" "https://<host>/.../page.html" | grep -oE '[^"]+(menuData|nav|example)[^"]*\.js[^"]*'
```

---

## 적용 대상 (마켓·택배사 매트릭스)

| 대상 | URL | 전략 | 적용 여부 |
|---|---|---|---|
| 쿠팡 | `developers.coupangcorp.com/hc/ko` | A (Zendesk) | ✅ 2026-05-28 실행 (11 섹션 / 99 article, #244) |
| 로젠택배 | `openapihome.ilogen.com/lsy06f-api-service` | B (정적 HTML) | ✅ 2026-05-29 실행 (7 섹션 / 19 article + README, #247) |
| 11번가 | TBD (셀러오피스 OpenAPI) | ❓ | 미실행 — 판별 먼저 |
| 네이버 커머스 API 센터 | TBD | ❓ | 미실행 — 판별 먼저 (Swagger/자체 docs 가능성) |
| G마켓 / 옥션 (ESM) | `etapi.gmarket.com` | C (Tistory) | ✅ 2026-05-29 실행 (7 섹션 / 118 article + README). ESM Plus 공용 → 옥션 동일 spec |

신규 대상은 라우터로 유형 판별 → 해당 전략 적용. 유형이 셋 다 아니면 신규 전략 추가.

---

## 산출물 구조 (전략 공통)

```
docs/handoff/<market>-api-index.md                # 전체 인덱스 (섹션별 article 링크)
docs/architecture/v1/features/<market>-api/       # 영구 spec 디렉토리
  README.md                                       # (선택) dev-guide/인증/공통 가이드 — 전략 B 등
  <section-slug-en>/
    <article-slug>.md                             # 각 article 1 파일 (메타 헤더 + 변환 본문)
```

article 파일 헤더 형식 (전략별 메타 키만 다름):

```markdown
# <article 제목>

> 출처: <html_url>
> [Zendesk article id: `<id>`  |  screenName: `<screen>`]   ← 전략에 맞는 식별자
> 섹션: <한글 섹션명>
> 추출 시점: YYYY-MM-DD

---

<HTML body 변환 마크다운>

## 요청/응답 예시   ← 예시 JSON 이 별도로 제공되는 사이트(전략 B 등)만
...
```

`<market>` slug 는 도메인 직관적으로. 마켓플레이스는 마켓명(`coupang`/`naver`/`11st`/`gmarket`/`auction`), 택배사는 캐리어명(`logen` 등). 택배사는 5개 마켓플레이스가 아니므로 어댑터/도메인 분류 시 구분 (배송/송장 도메인).

---

## 전제 조건 (전략 공통)

- Python 3.9+ + markdownify + beautifulsoup4
  ```bash
  pip3 install --user markdownify beautifulsoup4
  ```
- curl + jq
- 사이트가 봇 차단을 하므로 모든 curl 에 `-A "Mozilla/5.0 ..."` user-agent 위장 필수.
- WebFetch 도구는 일부 사이트(예: 쿠팡 root) 가 403 반환 — JSON endpoint 는 통과. 봇 차단된 일반 페이지 접근이 필요하면 MCP playwright (firefox). headless chromium 은 `chrome-for-testing` 미설치 이슈로 미사용.
- 추출 시점은 `EXTRACT_DATE` env 로 주입 (`static-html-to-md.py` 가 읽음). 예: `export EXTRACT_DATE=$(date +%F)` — 단, 스크립트 외부에서 현재 날짜 확정 후 고정값으로 전달.

---

## 전략 A — Zendesk Help Center (쿠팡 1회 실행 기준 — 2026-05-28)

Zendesk REST API(`/api/v2/help_center/...`)로 카테고리·섹션·article 을 JSON 으로 받아 `zendesk-article-to-md.py` 로 변환.

### A-1. Help Center 구조 식별

```bash
BASE="https://developers.coupangcorp.com/api/v2/help_center/ko"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
curl -sS -A "$UA" "$BASE/categories.json" | jq '.categories[] | {id, name, html_url}'
```

사용자에게 import 할 카테고리 확정 받기 (보통 `API Docs` 1개. Guides/FAQs 는 제외).

### A-2. 섹션 매핑 식별

```bash
CAT_ID=360002105414  # 쿠팡 API Docs
curl -sS -A "$UA" "$BASE/categories/$CAT_ID/sections.json?per_page=100" | jq '.sections[] | {id, name}'
```

한글 섹션명 → 영문 slug 매핑을 사용자와 함께 만든다. 슬러그는 도메인 직관적이고 짧게. 예 (쿠팡):

| 섹션 (한글) | slug | section_id |
|---|---|---|
| 카테고리 APIs | `category` | 360005046514 |
| 상품 APIs | `product` | 360005046534 |
| 교환 APIs | `exchange` | 360005046554 |
| 쿠폰 / 캐시백 APIs | `coupon-cashback` | 360005046574 |
| 물류센터 APIs | `logistics` | 360005081873 |
| 배송 / 환불 APIs | `shipping-refund` | 360005081913 |
| 반품 APIs | `return` | 360005081933 |
| CS APIs | `cs` | 360005081953 |
| 정산 APIs | `settlement` | 360005081973 |
| 로켓그로스 APIs | `rocket-growth` | 35157469062553 |
| 브랜드 APIs | `brand` | 58348875092889 |

### A-3. 전체 article 메타 fetch (페이지네이션)

```bash
curl -sS -A "$UA" \
  "$BASE/categories/$CAT_ID/articles.json?per_page=100&page=1&sort_by=position&sort_order=asc" \
  -o /tmp/articles-p1.json
jq '{count, page_count, page, next_page}' /tmp/articles-p1.json
# next_page null 이 될 때까지 page=2,3,... 반복. 쿠팡은 99 < 100 이라 page 1 만으로 완료.

jq -r --argjson secmap '{"360005046514":"category", ...}' '
  .articles[] | "\(.id)|\(.section_id)|\($secmap[(.section_id|tostring)])"
' /tmp/articles-p1.json > /tmp/article-list.txt
```

### A-4. 인덱스 마크다운 생성

```bash
jq -r --slurpfile s <(curl -sS -A "$UA" "$BASE/categories/$CAT_ID/sections.json?per_page=100") '
  ($s[0].sections | map({key: (.id|tostring), value: .name}) | from_entries) as $secmap |
  .articles | sort_by(.section_id, .position // 0) | group_by(.section_id)
  | map({ section_name: $secmap[(.[0].section_id|tostring)], articles: map({id, title, html_url}) })
' /tmp/articles-p1.json > /tmp/grouped.json

jq -r '
  "# <market> Open API 인덱스 (자동 추출)\n",
  "출처: <https://...> (Zendesk Help Center API).",
  "총 \(. | length) 섹션 / \([.[].articles | length] | add)개 article. **추출 시점: YYYY-MM-DD**.\n",
  "---\n",
  (.[] | "## \(.section_name) (\(.articles|length))\n\n" + (.articles | map("- [\(.title)](\(.html_url))") | join("\n")) + "\n")
' /tmp/grouped.json > docs/handoff/<market>-api-index.md
```

### A-5. article 본문 변환

`zendesk-article-to-md.py` 사용 (article JSON + 섹션 한글명 + 출력 디렉토리).

```bash
ROOT="docs/architecture/v1/features/<market>-api"
while IFS='|' read -r id sid slug; do
  name=$(get_section_name "$slug")
  curl -sS -A "$UA" "$BASE/articles/$id.json" -o /tmp/art-$id.json
  python3 .claude/skills/market-api-docs-import/zendesk-article-to-md.py \
    /tmp/art-$id.json "$name" "$ROOT/$slug" >/dev/null
done < /tmp/article-list.txt
find "$ROOT" -name "*.md" | wc -l
```

### A-6. 검수 → A-7. commit + PR

검수·commit·PR 은 아래 "전략 공통 — 검수 / commit / PR" 참조.
- 전략 A 특이사항: Zendesk nested table 은 평탄화돼 가독성 낮을 수 있음 (한 셀에 sub-table) — **그대로 둔다**. 정확한 spec 은 출처 URL.

---

## 전략 B — 정적 HTML + JS nav (로젠택배 1회 실행 기준 — 2026-05-29)

서버 렌더 HTML 페이지. 본문은 `.content-box` 등 컨테이너에 직접 있고, 좌측 nav 와 요청/응답 예시는 별도 JS/JSON 파일에서 주입. 변환은 `static-html-to-md.py` 사용.

### B-1. nav 데이터 소스에서 전체 페이지 목록 추출

페이지의 `<script src>` 에서 nav 데이터 파일을 찾는다 (로젠: `include_common.js` → `menuData.js`).

```bash
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
SITE="https://openapihome.ilogen.com/lsy06f-api-service"
curl -sS -A "$UA" "$SITE/pages/api-docs/contract-info.html" | grep -oE 'src="[^"]+\.js"'   # nav js 후보
curl -sS -A "$UA" "$SITE/assets/js/menuData.js"   # 전체 메뉴 트리(섹션·서브메뉴·link)
```

`menuData.js` 의 `const menuData = [...]` 트리에서 import 대상 카테고리(보통 "API Docs")의 (섹션명 → 페이지 link) 목록을 추출. 사용자에게 카테고리/섹션 확정 받기. 한글 섹션명 → 영문 slug 매핑 작성 (로젠 예):

| 섹션 (한글) | slug | article |
|---|---|---|
| 거래처 계약 | `contract` | contract-info, contract-fare |
| 자체 시스템 송장출력 | `invoice-self` | invoice-number-assign, safe-number, invoice-print-info, invoice-order-register |
| iLOGEN 주문등록 | `order` | bulk-order, invoice-query |
| 로젠시스템 송장 출력 URL | `invoice-url` | logen-invoice-url |
| 반품 | `return` | return-register, return-branch-fare, return-contractfare, return-status-invoice, return-status-invoice-order, return-info, return-cancel |
| 화물추적 | `tracking` | tracking-api, tracking-final |
| 기타 | `etc` | etc |

### B-2. 요청/응답 예시 소스 확인 (있으면)

Example 버튼이 별도 JSON 을 fetch 하는 구조면 그 JSON 을 받아둔다 (로젠: `exampleModal.js` → `exampleData.json`, screenName→{input,output}).

```bash
curl -sS -A "$UA" "$SITE/js/exampleModal.js"                       # fetch 경로 확인
curl -sS -A "$UA" "$SITE/pages/api-docs/exampleData.json" -o /tmp/example.json
jq -r 'keys[]' /tmp/example.json    # screenName 목록이 article slug 와 일치하는지 확인
```

### B-3. 전체 article fetch + 변환

`(screen | section_slug | section_kr)` 리스트를 만들어 루프. 본문 컨테이너 셀렉터는 사전 확인 (로젠=`.content-box`).

```bash
SITE="https://openapihome.ilogen.com/lsy06f-api-service"
BASEURL="$SITE/pages/api-docs"
ROOT="docs/architecture/v1/features/logen-api"
EX=/tmp/example.json
export EXTRACT_DATE=2026-05-29   # 현재 날짜를 외부에서 확정 후 고정값으로

LIST='contract-info|contract|거래처 계약
contract-fare|contract|거래처 계약
... (menuData 순서대로 전체)'

while IFS='|' read -r screen sslug sname; do
  url="$BASEURL/$screen.html"
  curl -sS -A "$UA" "$url" -o /tmp/$screen.html
  python3 .claude/skills/market-api-docs-import/static-html-to-md.py \
    /tmp/$screen.html "$sname" "$screen" "$ROOT/$sslug" "$url" "$EX" ".content-box" >/dev/null
done <<< "$LIST"
find "$ROOT" -name '*.md' | wc -l   # 기대 article 수와 일치 확인
```

- `static-html-to-md.py` 인자: `<html> <섹션한글> <screen> <out_dir> <page_url> [example_json] [content_selector]`.
- 버튼 처리: `btn-indigo`=HTTP method 라벨 보존, 그 외(Example 등)=제거. example JSON 제공 시 `## 요청/응답 예시` 로 input/output 병합.

### B-4. 인덱스 마크다운 생성

각 md 의 첫 줄(`# 제목`)을 뽑아 섹션별로 묶는다 (menuData 순서 유지). `docs/handoff/<market>-api-index.md`. 헤더에 API 환경(dev/운영 도메인)·인증키 발급 경로·재추출 안내 포함. (로젠 인덱스 실물: `docs/handoff/logen-api-index.md`)

### B-5. 공통 가이드 README (있으면)

dev-guide/인증/IP·Header 같은 공통 페이지가 있으면 `<market>-api/README.md` 로 변환해 박는다 (로젠: `dev-guide/token-usage.html`). 프로젝트 연동 메모(고정 IP 화이트리스트 = Lightsail `3.36.239.243`, credential vault 암호화, 토큰 로테이션 등)를 하단에 덧붙인다.

### B-6. 검수 → B-7. commit + PR

아래 "전략 공통 — 검수 / commit / PR" 참조.
- 전략 B 장점: Input/Output params 테이블·dev/운영 URL·HTTP 메서드·수정이력이 깔끔히 보존되고 example JSON 까지 병합 (Zendesk nested-table 평탄화 문제 없음).

---

## 전략 C — Tistory 블로그 (G마켓·옥션 ESM 1회 실행 기준 — 2026-05-29)

Tistory 블로그에 글 1개 = API 1개로 올라온 사이트(`etapi.gmarket.com`). 글 본문은 `.entry-content`, 제목은 본문 밖 `og:title`. 카테고리 페이지(`/category/<name>`)가 섹션별 글 목록(페이지네이션 `?page=N`). 변환은 `tistory-to-md.py`.

### C-1. 카테고리 → 글 목록 크롤 (페이지네이션)

사용자가 준 카테고리 URL 들이 곧 섹션. 각 카테고리를 `?page=1..N` 돌며 글 링크(`href="/숫자"`)를 새 항목 없을 때까지 수집. 한글 섹션명 → slug 매핑 (ESM 예):

| 섹션 (한글) | slug | 글 수 |
|---|---|---|
| 상품 API | `product` | 44 |
| 주문 · 배송 API | `order-shipping` | 8 |
| 클레임 API | `claim` | 20 |
| 정산조회 API | `settlement` | 3 |
| CS API | `cs` | 5 |
| 서비스 API | `service` | 12 |
| 스타배송 API | `star-delivery` | 26 |

```python
# python (urllib) — 카테고리당 글 id 수집
import urllib.request, urllib.parse, re
def get(u): return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent":UA}),timeout=40).read().decode("utf-8","replace")
enc=urllib.parse.quote("상품API")
ids=[]
for p in range(1,12):
    new=[int(x) for x in re.findall(r'href="/(\d+)"', get(f"https://etapi.gmarket.com/category/{enc}?page={p}")) if int(x) not in ids]
    if not new: break
    ids+=new
```

- RSS(`/rss`)는 최신 10개뿐이라 전체 목록엔 부적합 — 카테고리 페이지네이션이 source of truth.
- 카테고리 간 중복 글이 없는지 확인(ESM 은 0). 있으면 한 곳에만 배치.

### C-2. 글 fetch + 변환

각 글 id 마다 `/<id>` HTML 을 받아 `tistory-to-md.py` 로 변환. 출력 파일명 = post id. og:title 은 인덱스용으로 함께 수집.

```bash
export EXTRACT_DATE=2026-05-29
python3 .claude/skills/market-api-docs-import/tistory-to-md.py \
  /tmp/esm/<id>.html "<섹션한글>" "<id>" "docs/architecture/v1/features/esm-api/<slug>" \
  "https://etapi.gmarket.com/<id>" ".entry-content" >/dev/null
```

- `tistory-to-md.py` 가 글 끝 "카테고리의 다른 글" 관련글 네비 + 공유/좋아요 버튼을 제거(spec 아님). 변환 후 `grep -rl '카테고리의 다른 글'` 로 누수 0 확인.
- Request/Response/Error Code 표 + JSON 예시(`<pre>`)는 깨끗이 보존됨.

### C-3. 인덱스 + README

- 인덱스: manifest(id·slug·section·title·url) 로 섹션별 묶어 `docs/handoff/<market>-api-index.md`.
- README: "API 가이드" 페이지(`/pages/...`)를 변환해 `<market>-api/README.md`. ESM 은 인증(JWT/HMAC) 구성이 가이드에 있으니 프로젝트 연동 메모(payload.ssi siteId G/A, 고정 IP, secret key vault) 덧붙임.
- ⚠️ Tistory 본문 이미지(kakaocdn)는 만료 서명 URL — 시간 지나면 깨짐. 이미지는 보조, 정확한 건 출처 URL.

### C-4. 검수 → C-5. commit + PR

아래 "전략 공통 — 검수 / commit / PR" 참조.

---

## 전략 공통 — 검수 / commit / PR

**검수 (Phase 6)** — 각 섹션 첫 article 1개씩 사용자에게 보여주고 quality 확인. 헤딩/단락/링크/코드블록/테이블 보존 확인. 사용자 OK 후 나머지 batch.

**commit + PR (Phase 7)**:
- 브랜치: `chore/<market>-api-docs-import`
- commit 분리 (의존성 순 — 상세 먼저, 인덱스가 상세를 가리킴):
  1. `docs(<market>): API 상세 spec 마크다운 import (N 개 article × M 섹션)`
  2. `docs(<market>): Open API 인덱스 추가 (docs/handoff/<market>-api-index.md)`
  3. (전략 B README 있으면) `docs(<market>): API 사용방법 가이드 README 추가`
- PR base = `develop`. docs-only 이므로 WIP 갱신 불필요. auto-merge squash 권장 (CI BEHIND 시 `gh pr update-branch` 후 재시도).

---

## 신규 전략 추가 (라우터 3번에 걸린 경우)

유형이 A/B 둘 다 아니면 거부하지 말고 레시피를 만든다:

1. 본문이 어디 있는지 식별 — 서버 HTML? SPA(JS 렌더)? Swagger/OpenAPI json? GitBook/Docusaurus?
   - SPA 라 본문이 비면 MCP playwright(firefox) 로 렌더 후 DOM 추출, 또는 사이트의 spec json(`/openapi.json`·`swagger.json`) 직접 파싱.
2. 전체 페이지/엔드포인트 목록의 source of truth 를 찾는다 (sitemap, nav json, openapi paths 등).
3. 본문 → 마크다운 변환기를 작성/재사용 (`static-html-to-md.py` 를 셀렉터만 바꿔 재사용 가능한 경우 많음).
4. 본 SKILL.md 에 "전략 C — <유형>" 섹션과 매트릭스 행을 추가하고, 변환 스크립트를 스킬 디렉토리에 저장.

---

## 핵심 룰 (전략 공통)

- **사이트 유형 먼저 판별** — Zendesk 라 단정하지 말 것. 라우터부터.
- **표 변환은 best-effort**: 정확한 spec 은 article 헤더 출처 URL. 본문은 검색용 색인.
- **추출 시점 명기**: 각 article md 헤더 + 인덱스 헤더에 `추출 시점: YYYY-MM-DD`. 현재 날짜는 외부에서 확정 후 고정값으로 주입(`EXTRACT_DATE`). stale 위험 — 어댑터 작업 직전 재실행 권장.
- **자동 동기화 안 함**: 원본이 갱신돼도 우리 md 는 그대로. 사용자 명시 트리거 시에만 갱신.
- **사용자 노출 정보 0**: 본문만. 작성자/모더레이션/draft/예시 secretKey 등 민감값은 제거(변환 스크립트 처리). 인증키·토큰은 절대 spec 에 평문 박지 않음.
- **bot 차단 회피**: 모든 curl 에 user-agent 위장. WebFetch 403 가능 — JSON/정적 endpoint 우선. 막히면 MCP playwright(firefox).

---

## 거부 / 보류 상황

- **인증 필요한 페이지 (로그인 후 docs)** — 본 스킬은 public docs 만. 인증 docs 는 셀러가 직접 캡처해서 공유.
- **이미 같은 대상 docs 가 `docs/architecture/v1/features/<market>-api/` 에 존재** — 사용자에게 재import / 증분 갱신 / skip 중 택1. 기본은 skip (덮어쓰면 사용자 수정 손실).
- **사이트 유형 미상(라우터 3번)** — 거부하지 말고 "신규 전략 추가" 절차로 레시피 작성 후 진행. 단, SPA·인증·동적 렌더로 자동 추출이 불가하면 사용자에게 제약을 알리고 수동 캡처 협의.
