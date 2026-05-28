---
name: market-api-docs-import
description: 마켓 OpenAPI 공식 문서 사이트를 통째로 fetch 해서 프로젝트의 영구 설계 디렉토리에 마크다운으로 인덱스+상세 변환하는 워크플로우. 사용자가 "쿠팡 API 문서 정리", "네이버 OpenAPI docs 가져와", "마켓 API docs 다운로드", "Zendesk Help Center 문서 변환" 이라고 말하거나, 새 마켓 어댑터 (네이버/11번가/G마켓/옥션/쿠팡) 구현 직전·기존 어댑터 회귀 검토 시 docs 가 stale 한 시점에 트리거. 일회성 외부 fetch 가 아닌, 프로젝트 영구 산출물로 박는 절차.
---

# 마켓 API 문서 import 스킬

쿠팡·네이버 등 마켓의 공식 OpenAPI 문서 사이트를 분석해서 article 단위 마크다운으로 변환·인덱싱한다. 마켓 어댑터 (`apps/api/supabase/functions/_shared/markets/<market>/*`) 구현 시 매번 외부 사이트 조회 없이 grep / Read 로 spec 참조 가능하게 만드는 게 목적.

---

## 적용 대상 (Zendesk Help Center 기반 사이트)

| 마켓 | URL | 적용 여부 |
|---|---|---|
| 쿠팡 | `developers.coupangcorp.com/hc/ko` | ✅ 2026-05-28 1회 실행 검증 (11 섹션 / 99 article) |
| 11번가 | TBD | ❓ Help Center API 형태 확인 필요 |
| 네이버 커머스 API 센터 | TBD | ❓ 다른 docs 시스템 가능성 |
| G마켓 / 옥션 (ESM) | TBD | ❓ |

판별 절차: 사이트 root 가 `/hc/<locale>` 형태이고 `/api/v2/help_center/<locale>/categories.json` 호출 시 JSON 반환되면 Zendesk Help Center.

Zendesk 가 아닌 사이트는 본 스킬 범위 밖 — 별도 어댑터 스킬 작성.

---

## 산출물 구조

```
docs/handoff/<market>-api-index.md                # 전체 인덱스 (섹션별 article 링크)
docs/architecture/v1/features/<market>-api/       # 영구 spec 디렉토리
  <section-slug-en>/
    <article-slug>.md                             # 각 article 1 파일 (메타 헤더 + 변환 본문)
```

각 article 파일 헤더 형식:

```markdown
# <article 제목>

> 출처: <html_url>
> Zendesk article id: `<id>`
> 섹션: <한글 섹션명>
> 추출 시점: YYYY-MM-DD

---

<HTML body 변환 마크다운>
```

---

## 전제 조건

- Python 3.9+ + markdownify + beautifulsoup4
  ```bash
  pip3 install --user markdownify beautifulsoup4
  ```
- curl + jq
- 사이트가 봇 차단을 하므로 모든 curl 에 `-A "Mozilla/5.0 ..."` user-agent 위장 필수.
- WebFetch 도구는 일부 사이트(예: 쿠팡 root) 가 403 반환 — `/api/v2/help_center/*` JSON endpoint 는 통과. 일반 페이지 접근이 필요한 경우 MCP playwright (firefox) 사용.

---

## 절차 (쿠팡 1회 실행 기준 — 2026-05-28)

### Phase 1 — Help Center 구조 식별

```bash
BASE="https://developers.coupangcorp.com/api/v2/help_center/ko"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

curl -sS -A "$UA" "$BASE/categories.json" | jq '.categories[] | {id, name, html_url}'
```

사용자에게 import 할 카테고리 확정 받기 (보통 `API Docs` 1개. Guides/FAQs 는 제외).

### Phase 2 — 섹션 매핑 식별

```bash
CAT_ID=360002105414  # 쿠팡 API Docs
curl -sS -A "$UA" "$BASE/categories/$CAT_ID/sections.json?per_page=100" \
  | jq '.sections[] | {id, name}'
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

### Phase 3 — 전체 article 메타 fetch (페이지네이션)

```bash
curl -sS -A "$UA" \
  "$BASE/categories/$CAT_ID/articles.json?per_page=100&page=1&sort_by=position&sort_order=asc" \
  -o /tmp/articles-p1.json

jq '{count, page_count, page, next_page}' /tmp/articles-p1.json
# next_page null 이 될 때까지 page=2,3,... 반복.
# 쿠팡은 99 article < 100 이라 page 1 만으로 완료.

# section_id → slug 매핑 적용해서 article 별 (id, section_id, slug) 추출
jq -r --argjson secmap '{"360005046514":"category", ...}' '
  .articles[] | "\(.id)|\(.section_id)|\($secmap[(.section_id|tostring)])"
' /tmp/articles-p1.json > /tmp/article-list.txt
```

### Phase 4 — 인덱스 마크다운 생성

`docs/handoff/<market>-api-index.md` 에 섹션별 그룹 + article 링크 리스트.

```bash
# section_id → name 매핑 jq 변수
jq -r --slurpfile s <(curl -sS -A "$UA" "$BASE/categories/$CAT_ID/sections.json?per_page=100") '
  ($s[0].sections | map({key: (.id|tostring), value: .name}) | from_entries) as $secmap |
  .articles
  | sort_by(.section_id, .position // 0)
  | group_by(.section_id)
  | map({
      section_name: $secmap[(.[0].section_id|tostring)],
      articles: map({id, title, html_url})
    })
' /tmp/articles-p1.json > /tmp/grouped.json

# 마크다운 변환 (jq raw output)
jq -r '
  "# <market> Open API 인덱스 (자동 추출)\n",
  "출처: <https://...> (Zendesk Help Center API).",
  "총 \(. | length) 섹션 / \([.[].articles | length] | add)개 article. **추출 시점: YYYY-MM-DD**.\n",
  "---\n",
  (.[] | "## \(.section_name) (\(.articles|length))\n\n" + (.articles | map("- [\(.title)](\(.html_url))") | join("\n")) + "\n")
' /tmp/grouped.json > docs/handoff/<market>-api-index.md
```

### Phase 5 — article 본문 변환

본 스킬 디렉토리의 `zendesk-article-to-md.py` 사용. 입력: article JSON 파일 + 섹션 한글명 + 출력 디렉토리.

```bash
ROOT="docs/architecture/v1/features/<market>-api"

while IFS='|' read -r id sid slug; do
  name=$(get_section_name "$slug")   # 슬러그→한글명 매핑 함수
  curl -sS -A "$UA" "$BASE/articles/$id.json" -o /tmp/art-$id.json
  python3 .claude/skills/market-api-docs-import/zendesk-article-to-md.py \
    /tmp/art-$id.json "$name" "$ROOT/$slug" >/dev/null
done < /tmp/article-list.txt

find "$ROOT" -name "*.md" | wc -l   # 총 article 수와 일치 확인
```

### Phase 6 — 검수 (각 그룹 sample 1개씩)

각 섹션의 첫 article 을 사용자에게 보여주고 quality 확인.

- Zendesk 의 nested table 은 평탄화돼 가독성 낮을 수 있음 (한 셀에 sub-table 다 들어감) — **그대로 둔다**. 정확한 spec 은 article 헤더의 출처 URL 참조.
- 헤딩 / 단락 / 링크 / 코드블록은 정상 보존.
- 사용자 OK 후 나머지 batch.

### Phase 7 — commit + PR

- 브랜치: `chore/<market>-api-docs-import`
- commit 분리:
  1. `docs(<market>): Open API 인덱스 추가 (docs/handoff/<market>-api-index.md)`
  2. `docs(<market>): API 상세 spec 마크다운 import (N 개 article × M 섹션)`
- PR base = `develop`. auto-merge squash 권장.

---

## 핵심 룰

- **표 변환은 best-effort**: 일관된 자동 변환 어려움. 본문 검색용 색인 + URL 참조 fallback 로 충분.
- **추출 시점 명기**: 각 article md 헤더 + 인덱스 헤더에 `추출 시점: YYYY-MM-DD`. stale 위험 — 마켓 어댑터 작업 직전 재실행 권장.
- **자동 동기화 안 함**: 마켓이 article 갱신해도 우리 md 는 그대로. 사용자가 명시 트리거할 때만 갱신.
- **사용자 노출 정보 0**: article body 만 가져오고 작성자/모더레이션/draft 메타는 제거 (변환 script 가 처리).
- **bot 차단 회피**: 모든 curl 에 user-agent 위장. WebFetch 는 403 가능성 — JSON endpoint 만 사용.
- **봇 차단된 페이지 접근이 필요하면 MCP playwright (firefox)**. headless chromium 은 `chrome-for-testing` 미설치 이슈로 미사용.

---

## 거부 / 보류 상황

- **사이트가 Zendesk Help Center 아님** — 본 스킬 범위 밖. 별도 어댑터 스킬 필요.
- **인증 필요한 페이지 (로그인 후 보이는 docs)** — 본 스킬은 public docs 만. 인증 docs 는 셀러가 직접 캡처해서 공유.
- **이미 같은 마켓 docs 가 docs/architecture/v1/features/<market>-api/ 에 존재** — 사용자에게 재import / 증분 갱신 / skip 중 택1 받기. 기본은 skip (덮어쓰면 사용자 수정사항 손실).
