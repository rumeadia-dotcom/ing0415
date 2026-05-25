/**
 * Cycle 41 — Edge Function 응답 zod runtime parse audit.
 *
 * CLAUDE.md: "외부 데이터(서버 응답·마켓 API) = zod 런타임 검증 필수"
 *
 * 점검 결과 (코드 grep):
 *  ✓ registration-api.ts invokeEdge wrapper — zod parse
 *  ✓ markets-api.ts invokeEdge wrapper — zod parse
 *  ✓ shipping-api.ts invokeEdge wrapper — zod parse
 *  ✓ shipping-settings-api.ts — zod parse
 *  ✓ image-api.ts — zod parse
 *  ✓ trackAuthEvent / trackShippingEvent — fire-and-forget (응답 unused), parse 불필요
 *  ✓ useProductDraft.update — error 체크만, 반환값 unused
 *  ✓ fetchJobWithResults — RegistrationJobSchema.parse + MarketResultSchema.parse
 *  ⚠ useNaverTokenRefresh.invokeOnDemandRefresh — supabase.functions.invoke<RefreshResponse>
 *    generic 만 사용, runtime parse 누락 → 본 PR 에서 RefreshResponseSchema 추가
 *
 * 본 PR 의 수정:
 *  - useNaverTokenRefresh.ts: zod RefreshResponseSchema 추가
 *    + supabase.functions.invoke<unknown> 으로 generic 변경
 *    + safeParse + schema mismatch 시 MarketApiInvocationError throw
 */
console.log('Cycle 41 — Edge Function 응답 zod parse audit')
console.log('')
console.log('수정 사항:')
console.log('  useNaverTokenRefresh.invokeOnDemandRefresh: zod RefreshResponseSchema 추가')
console.log('  schema mismatch 시 MarketApiInvocationError throw')
