-- 20260521000011_drop_seller_recent_jobs.sql
--
-- 출처: docs/design-renewal/s2-dashboard.md §3.5 / docs/architecture/v1/features/dashboard.md §3.3.
--
-- 대시보드 좌측 본문 위젯이 "최근 등록 리스트" → "마켓별 주문 현황" 으로 교체됨.
-- 클라이언트는 `orders_with_dispatch_summary` view + `orders` (today) + `market_accounts` 를 합성하여
-- `fetchMarketOrdersSummary()` 를 구성 (apps/web/src/features/dashboard/api/dashboard-api.ts).
-- 더 이상 `seller_recent_jobs` view / `rpc_get_recent_jobs(int)` RPC 를 사용하지 않으므로 제거.
--
-- forward-only: 본 파일은 0008 (view) / 0010 (rpc) 마이그레이션을 그대로 두고, drop 만 새 마이그레이션으로 적용한다.

drop function if exists public.rpc_get_recent_jobs(int);
drop view if exists public.seller_recent_jobs;
