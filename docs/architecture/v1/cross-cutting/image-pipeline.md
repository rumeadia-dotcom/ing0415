# Image Pipeline (v1)

> 본 문서는 다중 마켓 상품 자동 등록 SaaS 의 **이미지 처리 파이프라인** 단일 진실 원장이다. `platform.md` (Supabase Storage / Edge Functions) / `security.md` (RLS·시크릿) / `testing.md` (멱등 검증) 와 함께 읽는다.
> PRD 근거: §1.1.2 (상품 정보 입력 - 이미지), §1.2.2 (마켓별 이미지 규격 자동 변환), §3.5 (이미지 업로드·관리).

---

## 1. 목적·범위

- **목적**: 셀러가 원본 이미지를 1회 업로드하면, 등록 대상 각 마켓 규격에 맞춘 변환본을 멱등·재시도 안전하게 생성·전송한다.
- **범위**: 클라이언트 업로드 → Storage 원본 적재 → Edge Function 변환 → Storage 변환본 캐싱 → 마켓 API 전송까지의 전 구간.
- **비범위**: HTML 상세설명 본문 이미지 (v2, §3.6), 동영상·360 회전 이미지, 외부 CDN 연동.

---

## 2. 데이터 흐름

```
 ┌──────────────┐    (1) 서명 URL 요청            ┌─────────────────────┐
 │  Browser     │ ─────────────────────────────▶ │ Edge Fn             │
 │  (RHF Form)  │                                │ image-upload-url    │
 │              │ ◀───────────────────────────── │ (signed URL 발급)   │
 └──────┬───────┘    (2) signed PUT URL          └─────────────────────┘
        │
        │ (3) PUT 원본 (multipart, max 10MB)
        ▼
 ┌────────────────────────────────────────────────┐
 │ Supabase Storage : product-images-original     │
 │ <sellerId>/<productId>/<imageId>.<ext>         │
 └──────────────────────┬─────────────────────────┘
                        │
                        │ (4) DB insert (product_images, status='uploaded')
                        ▼
 ┌────────────────────────────────────────────────┐
 │ Postgres : product_images                      │
 │  - 원본 메타 (width/height/bytes/hash)         │
 │  - 변환 상태 (per-market jsonb 또는 별 테이블) │
 └──────────────────────┬─────────────────────────┘
                        │
                        │ (5) RegistrationJob 시작 시 마켓당 1회 invoke
                        ▼
 ┌────────────────────────────────────────────────┐
 │ Edge Fn : image-transform                      │
 │  - 멱등 키 (imageId, market) 캐시 hit → skip   │
 │  - 원본 download → resize/recompress           │
 │  - 변환본 PUT                                  │
 └──────────────────────┬─────────────────────────┘
                        │
                        ▼
 ┌────────────────────────────────────────────────┐
 │ Supabase Storage : product-images-transformed  │
 │ <sellerId>/<productId>/<imageId>/<market>.<ext>│
 └──────────────────────┬─────────────────────────┘
                        │
                        │ (6) 마켓 어댑터가 변환본 URL 또는 binary 로
                        │     createProduct payload 구성
                        ▼
 ┌────────────────────────────────────────────────┐
 │ Edge Fn : market-register-<market>             │
 │  → 마켓 API (naver / coupang)                  │
 └────────────────────────────────────────────────┘
```

**원칙**:
- 클라이언트는 **원본만 업로드**. 변환은 절대 클라이언트에서 안 한다 (네트워크 비용·디바이스 성능 편차·재시도 신뢰성 모두 백엔드가 유리).
- 변환은 **등록 잡 시작 시점**에만 수행. 업로드 즉시 N개 변환은 v1 비용 낭비 (등록 안 할 마켓도 포함됨).
- 변환본은 캐시. 동일 (imageId, market) 재요청 시 Storage HEAD 로 존재 확인 → skip.

---

## 3. Storage 버킷 구조

### 3.1 버킷 일람

| 버킷 | 용도 | public | 보존 |
|---|---|---|---|
| `product-images-original` | 셀러 업로드 원본 | private | 영구 (셀러 삭제 시까지) |
| `product-images-transformed` | 마켓별 변환본 캐시 | private | 90일 (장기간 미사용 GC) |

> public 버킷 운영 금지. 마켓 API 가 image URL 을 요구하는 경우 **시그니처 URL** (TTL 1시간) 발급.

### 3.2 경로 규약

**원본**:
```
product-images-original/
  <sellerId>/
    <productId>/
      <imageId>.<ext>        # ext = jpg | jpeg | png | webp
```

**변환본**:
```
product-images-transformed/
  <sellerId>/
    <productId>/
      <imageId>/
        <market>.<ext>       # ext = 마켓이 요구하는 포맷
        <market>.meta.json   # 변환 결과 메타 (선택, 디버깅용)
```

- `sellerId`, `productId`, `imageId` 는 모두 UUID v4 (Postgres `uuid_generate_v4()`).
- 파일명에 셀러 PII (이메일·전화) 포함 금지. UUID 만.
- 동일 imageId 의 원본은 **불변** (immutable). 재업로드는 새 imageId 발급. 변환 캐시 무효화 비용을 0으로 유지.

### 3.3 RLS 정책 SQL

`storage.objects` 에 정책 추가. Supabase Storage 는 내부적으로 `storage.objects` 테이블 위에 RLS 적용.

```sql
-- 원본 버킷: 셀러는 본인 prefix 만 SELECT / INSERT / DELETE
create policy "original_select_own"
  on storage.objects for select
  using (
    bucket_id = 'product-images-original'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "original_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images-original'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "original_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'product-images-original'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 변환본 버킷: 셀러는 SELECT 만. INSERT/UPDATE/DELETE 는 service_role 만 (Edge Fn).
create policy "transformed_select_own"
  on storage.objects for select
  using (
    bucket_id = 'product-images-transformed'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- INSERT/UPDATE/DELETE 정책 없음 → anon/authenticated 키로는 쓰기 불가.
-- service_role (Edge Fn) 만 변환본 작성 가능.
```

> `(storage.foldername(name))[1]` = path 의 첫 segment. 위 규약에서 `<sellerId>` 가 첫 segment 이므로 `auth.uid()` 와 직접 비교.
> service_role 호출 경로 (변환 Edge Fn) 는 RLS bypass 한다. **security.md §RLS bypass 경로** 에 등록 의무.

---

## 4. 마켓별 이미지 규격 매트릭스

**경고**: 아래 수치 중 일부는 마켓별 공식 가이드 최종 확인 전이다. "확인 필요" 표기된 항목은 v1 구현 직전 **마켓 API 문서 원본** 으로 재검증 후 본 문서 갱신.

### 4.1 v1 대상 (네이버 스마트스토어 / 쿠팡)

| 항목 | 네이버 스마트스토어 | 쿠팡 WING |
|---|---|---|
| 대표 이미지 최대 가로 | 1000px (확인 필요) | 780px (확인 필요) |
| 대표 이미지 최소 가로 | 640px (확인 필요) | 500px (확인 필요) |
| 종횡비 | 1:1 권장 | 1:1 강제 |
| 허용 포맷 | JPEG / PNG | JPEG / PNG |
| 추천 출력 포맷 | JPEG (품질 85) | JPEG (품질 85) |
| 최대 파일 크기 | 10MB (확인 필요) | 5MB (확인 필요) |
| 색공간 | sRGB | sRGB |
| 투명도 | PNG 허용 단 배경 흰색 권장 | PNG 허용 |
| 추가 이미지 수 | 최대 10장 (확인 필요) | 최대 9장 (확인 필요) |
| 텍스트 워터마크 | 권장 안 함 | 금지 |

### 4.2 v2 대상 (참고, 어댑터 인터페이스만 v1 유지)

| 항목 | 11번가 | G마켓 ESM | 옥션 |
|---|---|---|---|
| 대표 이미지 최대 가로 | 600px (확인 필요) | 500px (확인 필요) | 500px (확인 필요) |
| 종횡비 | 1:1 | 1:1 | 1:1 |
| 허용 포맷 | JPG | JPG | JPG |
| 최대 파일 크기 | 2MB (확인 필요) | 2MB (확인 필요) | 2MB (확인 필요) |
| 추가 이미지 수 | 최대 5장 (확인 필요) | 최대 4장 (확인 필요) | 최대 4장 (확인 필요) |

### 4.3 규격 정의 위치

수치는 코드 상수로 흩지 말고 **단일 모듈** 에 모은다:

```ts
// supabase/functions/_shared/image-spec.ts
import { z } from 'zod';

export const ImageSpecSchema = z.object({
  maxWidth: z.number().int().positive(),
  minWidth: z.number().int().positive(),
  aspectRatio: z.tuple([z.number(), z.number()]),  // [w, h]
  aspectStrict: z.boolean(),                        // true = crop, false = warn only
  format: z.enum(['jpeg', 'png', 'webp']),
  quality: z.number().int().min(1).max(100),
  maxBytes: z.number().int().positive(),
  colorSpace: z.literal('sRGB'),
});

export type ImageSpec = z.infer<typeof ImageSpecSchema>;

export const IMAGE_SPECS: Record<MarketCode, ImageSpec> = {
  naver:   { maxWidth: 1000, minWidth: 640, aspectRatio: [1,1], aspectStrict: false,
             format: 'jpeg', quality: 85, maxBytes: 10 * 1024 * 1024, colorSpace: 'sRGB' },
  coupang: { maxWidth: 780,  minWidth: 500, aspectRatio: [1,1], aspectStrict: true,
             format: 'jpeg', quality: 85, maxBytes: 5  * 1024 * 1024, colorSpace: 'sRGB' },
  // 11st / gmarket / auction 은 v2 어댑터 구현 시 추가.
};
```

- `IMAGE_SPECS` 는 zod 로 부트 시 1회 검증. 잘못된 값 commit 차단.
- 마켓 어댑터의 `transformProduct()` 가 이 스펙을 참조해 변환을 요청 (단, 변환 자체는 어댑터 바깥 `image-transform` Edge Fn 이 수행 — 어댑터는 "이 이미지를 이 스펙으로 변환해 달라" 메타만 전달).

---

## 5. 업로드 파이프라인 (클라이언트)

### 5.1 흐름

1. **사용자 파일 선택** — `<input type="file" accept="image/jpeg,image/png,image/webp" multiple>` (shadcn `Input` 또는 dropzone 컴포넌트).
2. **클라이언트 1차 검증** — RHF + zod: 파일 수 ≤ 10, 각 파일 ≤ 10MB, MIME whitelist. **실패 시 서버 호출 안 함**.
3. **서명 URL 요청** — Edge Fn `image-upload-url` 호출. 요청에 `productId`, `count`, `mimeList` 전달. 응답: `[{ imageId, signedUrl, expiresAt }]`.
4. **Storage 직접 PUT** — Supabase JS `storage.from('product-images-original').uploadToSignedUrl(...)`. 진행률은 `XMLHttpRequest progress` 이벤트로 RHF UI 에 반영.
5. **DB row 생성** — 업로드 완료 후 Edge Fn `image-register` 호출. 응답에 이미지 메타 (width/height/bytes/hash) 포함. **이 시점에 `product_images.status = 'uploaded'`**.
6. **에러** — PUT 실패 시 클라이언트는 재시도 3회 (1s/3s/9s backoff). 모두 실패 시 에러 메시지 + 사용자 재선택 유도.

### 5.2 서명 URL 발급 Edge Fn

```ts
// supabase/functions/image-upload-url/index.ts
const RequestSchema = z.object({
  productId: z.string().uuid(),
  files: z.array(z.object({
    mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    bytes: z.number().int().positive().max(10 * 1024 * 1024),
  })).min(1).max(10),
});

const ResponseSchema = z.object({
  uploads: z.array(z.object({
    imageId: z.string().uuid(),
    path: z.string(),
    signedUrl: z.string().url(),
    expiresAt: z.string().datetime(),
  })),
});
```

- 발급 URL TTL = 5분.
- 셀러 소유 productId 검증 (RLS 우회 경로이므로 명시적 SELECT).
- correlationId 부여 + 구조화 로그 (CLAUDE.md "외부 API 로깅 패턴").

### 5.3 클라이언트 측 이미지 사전 처리 (옵션)

- **EXIF rotation 보정**만 클라이언트에서 수행 (canvas 1회 draw). 그 외 리사이즈는 안 함.
- HEIC 등 비표준 포맷은 클라이언트 측에서 차단 (지원 안 함 안내). v1 에서 HEIC → JPEG 변환 미지원.

---

## 6. `product_images` 테이블 DDL + RLS

```sql
create type image_status as enum (
  'pending',     -- 서명 URL 발급, PUT 미완료
  'uploaded',    -- 원본 업로드 완료, 변환 미수행
  'transforming',-- 변환 중 (특정 마켓)
  'ready',       -- 적어도 1개 마켓 변환 완료
  'failed'       -- 원본 자체 손상/검증 실패
);

create table product_images (
  id              uuid primary key default gen_random_uuid(),
  seller_id       uuid not null references auth.users(id) on delete cascade,
  product_id      uuid not null references products(id) on delete cascade,
  position        smallint not null check (position between 0 and 9),
  original_path   text not null,        -- product-images-original/<seller>/<product>/<id>.<ext>
  mime            text not null check (mime in ('image/jpeg','image/png','image/webp')),
  bytes           bigint not null check (bytes > 0 and bytes <= 10485760),
  width           int,                  -- 업로드 완료 후 채움
  height          int,
  sha256          text,                 -- 멱등성 키 (동일 파일 재업로드 감지)
  status          image_status not null default 'pending',
  uploaded_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (product_id, position),
  unique (seller_id, sha256)            -- 동일 셀러 동일 파일 재업로드 차단
);

create index product_images_product_idx on product_images (product_id);
create index product_images_status_idx on product_images (status);

alter table product_images enable row level security;

create policy "product_images_select_own"
  on product_images for select
  using (seller_id = auth.uid());

create policy "product_images_insert_own"
  on product_images for insert
  with check (seller_id = auth.uid());

create policy "product_images_update_own"
  on product_images for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

create policy "product_images_delete_own"
  on product_images for delete
  using (seller_id = auth.uid());
```

**별 테이블 `product_image_transforms`** — 마켓별 변환 결과 저장 (1:N).

```sql
create type transform_status as enum ('pending', 'running', 'succeeded', 'failed');

create table product_image_transforms (
  id              uuid primary key default gen_random_uuid(),
  image_id        uuid not null references product_images(id) on delete cascade,
  market          market_code not null,            -- 'naver' | 'coupang' | ...
  output_path     text,                            -- 변환본 Storage path (성공 시)
  output_bytes    bigint,
  output_width    int,
  output_height   int,
  output_format   text check (output_format in ('jpeg','png','webp')),
  status          transform_status not null default 'pending',
  error_code      text,                            -- 'src_too_small' | 'invalid_aspect' | ...
  error_message   text,                            -- 사용자 노출용 (마스킹 적용)
  attempts        smallint not null default 0,
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (image_id, market)                        -- 멱등성 키
);

create index pit_image_idx on product_image_transforms (image_id);
create index pit_status_idx on product_image_transforms (status);

alter table product_image_transforms enable row level security;

create policy "pit_select_own"
  on product_image_transforms for select
  using (
    exists (
      select 1 from product_images pi
      where pi.id = product_image_transforms.image_id
        and pi.seller_id = auth.uid()
    )
  );

-- INSERT/UPDATE 는 service_role 만. 클라이언트 직접 변경 차단.
```

---

## 7. 변환 파이프라인 (Edge Function `image-transform`)

### 7.1 호출 트리거

- **호출자**: `registration-job-runner` Edge Fn (마켓당 1회).
- **호출 단위**: `(productId, market)` — 해당 상품의 모든 이미지를 해당 마켓 스펙으로 변환.
- **입력**:
  ```ts
  const RequestSchema = z.object({
    jobId: z.string().uuid(),
    productId: z.string().uuid(),
    market: MarketCodeSchema,
    correlationId: z.string().uuid(),
  });
  ```
- **출력**:
  ```ts
  const ResponseSchema = z.object({
    market: MarketCodeSchema,
    results: z.array(z.object({
      imageId: z.string().uuid(),
      status: z.enum(['succeeded', 'failed', 'skipped']),  // skipped = 캐시 hit
      outputPath: z.string().nullable(),
      error: z.object({
        code: z.string(),
        message: z.string(),
      }).nullable(),
    })),
  });
  ```

### 7.2 멱등성

핵심 불변식: **동일 `(imageId, market)` 호출은 정확히 같은 산출물을 만들거나 캐시 hit 으로 즉시 반환한다.**

순서:
1. `product_image_transforms` 에서 `(imageId, market)` 행 조회.
2. `status = 'succeeded'` 이고 `output_path` 가 Storage 에 실제 존재(HEAD 확인) → `skipped` 반환.
3. `status = 'running'` 이고 `started_at` 이 5분 이내 → 다른 잡이 진행 중. **에러 아님**, `skipped` (상위 잡이 polling 으로 재확인).
4. 그 외 → 변환 시작. `status = 'running'`, `attempts += 1`, `started_at = now()`.
5. 변환 완료 후 `status = 'succeeded'` + 변환본 경로 기록.
6. 변환 실패 시 `status = 'failed'` + `error_code` 기록.

> `attempts >= 3` 이면 더 이상 자동 재시도 안 함. 상위 잡이 사용자에게 노출 (재시도 버튼).

### 7.3 변환 라이브러리 선택지

| 옵션 | 장점 | 단점 | 결론 |
|---|---|---|---|
| **`imagescript`** (순수 TS, Deno 네이티브) | Edge Fn 즉시 동작, 의존 0 | 속도·품질 wasm-vips 대비 열위. WebP 인코딩 미지원 (확인 필요). | **v1 채택 후보 1** |
| **`wasm-vips`** (libvips WASM) | 고품질·고속·포맷 풍부 | Edge Fn 메모리·콜드스타트 영향. Deno WASM 호환성 검증 필요 (미해결 사안 §11). | **v1 채택 후보 2** |
| **`@napi-rs/sharp`** | 최고 성능 | Node.js 네이티브 바인딩. Deno Edge Fn 비호환. | 거부 |
| **외부 변환 서비스** (Cloudinary 등) | 자체 운영 0 | 비용·외부 의존·PII 정책 충돌. | v1 거부 |

v1 결정: **`imagescript` 1차 채택, JPEG/PNG 만 변환**. WebP 출력은 v2 (필요해지면 `wasm-vips` 로 전환).

### 7.4 변환 로직

```ts
async function transformOne(
  image: ProductImage,
  spec: ImageSpec,
  logger: Logger,
): Promise<TransformResult> {
  // 1. 원본 download (service_role)
  const blob = await storage.download(image.originalPath);
  if (blob.size > spec.maxBytes * 2) {
    return fail('src_too_large', '원본이 변환 한계의 2배를 초과');
  }

  // 2. decode
  const img = await Image.decode(await blob.arrayBuffer());

  // 3. 크기 검증
  if (img.width < spec.minWidth) {
    return fail('src_too_small', `최소 가로 ${spec.minWidth}px 필요 (현재 ${img.width}px)`);
  }

  // 4. 종횡비 처리
  let processed = img;
  if (spec.aspectStrict) {
    processed = centerCrop(img, spec.aspectRatio);
  }

  // 5. resize (downscale only — upscale 금지)
  if (processed.width > spec.maxWidth) {
    processed = processed.resize(spec.maxWidth, Image.RESIZE_AUTO);
  }

  // 6. encode
  const encoded = spec.format === 'jpeg'
    ? await processed.encodeJPEG(spec.quality)
    : await processed.encode();  // PNG (quality 무시)

  // 7. 최종 크기 검증
  if (encoded.byteLength > spec.maxBytes) {
    return fail('output_too_large', '변환 후에도 크기 초과 — 품질 추가 하향 필요');
  }

  // 8. 변환본 업로드
  const outPath = `${image.sellerId}/${image.productId}/${image.id}/${spec.market}.${spec.format}`;
  await storage.upload('product-images-transformed', outPath, encoded, {
    contentType: `image/${spec.format}`,
    upsert: true,  // 멱등성: 동일 경로 덮어쓰기 안전
  });

  return success(outPath, encoded.byteLength, processed.width, processed.height);
}
```

- `Image.RESIZE_AUTO` = 비율 유지.
- upscale 금지 — 마켓 권장 해상도보다 작은 원본은 **변환 실패** 가 아니라 **경고**. v1 은 `min_width` 미달 시 `src_too_small` 실패 처리, 상위 잡이 사용자에게 노출 (재업로드 유도).
- `upsert: true` — 동일 경로 덮어쓰기. 멱등성 보장.

### 7.5 timeout / 리소스 제약

- Edge Fn timeout 한도 = **150초 가정** (Supabase 공식값 변동 시 본 문서 갱신).
- 1 호출당 이미지 ≤ 10장. 장당 평균 변환 시간 측정 후 잡 분할 임계치 결정.
- 메모리 한도 초과 우려: 4K (4096px+) 원본 + PNG 디코딩이 가장 위험. 디코딩 직후 가로 확인 → 즉시 다운스케일 (단계적).

### 7.6 로깅

```ts
logger.info({ market, jobId, productId, imageId, correlationId }, '→ image-transform start');
logger.info({ market, jobId, imageId, srcWidth, srcHeight, srcBytes }, 'src decoded');
logger.info({ market, jobId, imageId, outWidth, outHeight, outBytes }, 'transform success');
logger.warn({ market, jobId, imageId, code }, 'transform failed');
```

> 셀러 PII 금지. `sellerId` 는 RLS 우회 경로 디버깅 목적상 필요 시 UUID 만 기록.

---

## 8. 저장 경로 결정 규칙

1. **원본은 절대 덮어쓰지 않는다.** `upsert: false` 강제. 같은 imageId 가 이미 있으면 409 반환 → 클라이언트 재시도 시 새 imageId 발급.
2. **변환본은 덮어쓸 수 있다.** 변환 알고리즘 개선 후 강제 재변환 가능해야 함. `upsert: true`.
3. **삭제는 cascade.** `products` 행 삭제 시 DB FK cascade → 변환본·원본은 **별도 후처리 잡** (`storage-gc`, 일 1회) 이 정리. DB 트랜잭션 안에서 Storage 삭제 절대 금지 (rollback 불가).
4. **셀러 탈퇴 시** — `seller_id` 기준 Storage prefix 전체 삭제. 별도 Edge Fn `seller-purge` 가 처리. RLS bypass + audit log 필수 (security.md §탈퇴 절차).

---

## 9. 에러 처리

### 9.1 분류

| 에러 코드 | 의미 | 상위 잡 영향 | 사용자 메시지 |
|---|---|---|---|
| `src_too_small` | 원본 가로가 마켓 최소 미달 | 해당 (image, market) 실패 | "이미지가 너무 작습니다. 최소 {minWidth}px 필요" |
| `src_too_large` | 원본이 한계의 2배 초과 (의심스러운 파일) | 실패 | "원본 파일이 너무 큽니다. 10MB 이하로 다시 업로드" |
| `invalid_aspect` | 종횡비 강제인데 crop 불가 | 실패 | "1:1 비율로 자를 수 없습니다" |
| `decode_failed` | 손상된 파일 | 실패 (해당 image 모든 market) | "이미지 파일이 손상되어 읽을 수 없습니다" |
| `output_too_large` | 변환 후에도 한계 초과 (이미 품질 최저 시) | 실패 | "이미지 압축에 실패했습니다" |
| `storage_upload_failed` | Storage 업로드 5xx | **재시도** (max 3) | 사용자 노출 안 함 (자동 재시도) |
| `unknown` | 그 외 | 실패 + Sentry alert | "이미지 처리 중 오류가 발생했습니다" |

### 9.2 상위 잡 전달

- 변환 실패 → `registration_job_market_results.status = 'failed'`, `error_code = 'image_<code>'`, `error_message = <마스킹된 메시지>`.
- **한 이미지의 한 마켓 변환 실패가 다른 마켓 변환을 막지 않는다.** (병렬 마켓 독립 원칙, CLAUDE.md "마켓 어댑터 추상화")
- 단, 동일 이미지의 `decode_failed` 같은 원본 자체 결함은 **모든 마켓** 에 동일 전달 (재시도해도 무의미).

### 9.3 사용자 액션

- 등록 결과 화면 (`s3.n21`) 에서 실패 이미지 + 마켓 조합을 표 형태로 노출.
- "이미지 교체" 버튼 → 해당 imageId 의 `product_images.status = 'failed'` 표시 + 새 업로드 슬롯 제공.
- "이 마켓 제외하고 재등록" 버튼 → `RegistrationJob` 재실행 (CLAUDE.md §재시도 정책 참조).

---

## 10. 테스트 매트릭스

### 10.1 단위 테스트 (Vitest / Deno test)

| 대상 | 케이스 |
|---|---|
| `centerCrop()` | 1:1, 4:3, 3:4 입력 → 정확한 픽셀 좌표 |
| `transformOne()` happy | 1200x1200 JPEG → naver 스펙 → 1000x1000 JPEG |
| `transformOne()` 종횡비 | 1200x800 → coupang aspectStrict=true → 1:1 crop |
| `transformOne()` upscale 거부 | 400x400 → naver minWidth=640 → `src_too_small` |
| `transformOne()` 멱등 캐시 hit | 동일 (imageId, market) 두 번 → 1회만 실제 변환 |
| `IMAGE_SPECS` zod | 모든 마켓 스펙이 zod 통과 (부트 시 1회) |

### 10.2 통합 테스트 (Supabase 로컬 + Edge Fn)

| 시나리오 | 검증 |
|---|---|
| 서명 URL → PUT → DB row | `product_images.status` = 'uploaded' 로 전이 |
| RLS 격리 | 셀러 A 가 셀러 B 의 원본 path SELECT 시 0 row |
| 서명 URL 만료 | 5분 후 PUT 시도 → 403 |
| 변환 후 DB | `product_image_transforms.status` = 'succeeded' + `output_path` 존재 |
| 변환본 RLS | 셀러 A 가 셀러 B 의 변환본 GET 시 403 |
| 중복 업로드 | 동일 sha256 → DB unique 위반 → 409 |

### 10.3 E2E (Playwright)

| 시나리오 | 검증 |
|---|---|
| 골든 패스 | 로그인 → 상품 등록 위저드 → 이미지 3장 업로드 → 마켓 2개 선택 → 등록 완료 화면에서 변환본 썸네일 노출 |
| 손상 파일 업로드 | 잘못된 헤더의 JPG → "이미지 파일이 손상..." 메시지 + 잡 진행 안 함 |
| 너무 작은 이미지 | 400x400 PNG → 등록 잡 진행 → 결과 화면에서 해당 (image, market) 실패 표시 + 다른 마켓은 성공 |
| 한 마켓만 실패 | naver 통과 / coupang `output_too_large` → `registration_jobs.status = 'partial'` |

### 10.4 부하·회귀

- 단일 잡 10장 × 2마켓 = 20 변환의 p95 시간 측정. Edge Fn timeout 의 50% 이내 유지.
- 4K 원본 PNG → 메모리 OOM 안 나는지 확인 (사전 다운스케일 효과 검증).

---

## 11. 미해결 사안

1. **wasm-vips Deno Edge Fn 호환성** — 메모리·콜드스타트 측정 필요. v1 은 `imagescript` 로 우회, v2 에서 WebP 출력 요구 시 재검토.
2. **Supabase Edge Fn timeout 한도 공식 수치** — 본문 150초 가정. 공식값 확인 후 잡 분할 임계치 재계산.
3. **마켓 이미지 스펙 정확한 수치** — 네이버 스마트스토어 / 쿠팡 WING 공식 가이드 1차 확인 후 §4 표 갱신 + zod 부트 검증 통과.
4. **HEIC 입력 지원** — iOS 사진 기본 포맷. v1 미지원이면 클라이언트 안내. v2 도입 시 클라이언트 측 JS HEIC 디코더 (`heic2any`) 또는 Edge Fn 측 `wasm-vips` 활용 결정 필요.
5. **변환본 GC 정책** — 90일 미사용 자동 삭제. 셀러가 그 사이 상품 비활성화 후 재활성화하면 캐시 미스 → 재변환. 비용 vs 일관성 트레이드오프 확정 필요.
6. **원본 백업** — 셀러 실수 삭제 복구 정책 없음 (v1). 재해 복구 SLA 와 함께 ops 에서 결정.
7. **이미지 검수 (AI 부적절 콘텐츠 필터)** — v1 미포함. 마켓 측 검수에 의존. v2 검토.
8. **상품당 이미지 수 한도** — 현재 DB 제약 0~9 (10장). 마켓별 한도 (스마트스토어 10 / 쿠팡 9 추정) 와 정합성 재확인.

---

## 12. 변경 이력

| 일자 | 변경 | 작성 |
|---|---|---|
| 2026-05-18 | 최초 작성 (Phase 0 cross-cutting) | backend |
