/**
 * Cycle 42 — ReactQueryDevtools dynamic import (real 번들 청크 분리).
 *
 * 점검:
 *  - AppProviders 가 static import 로 ReactQueryDevtools 를 가져왔음.
 *  - isDev 가 런타임 변수라 Vite tree-shaking 으로 제거 안 됨 (~60KB 잔여).
 *  - dev 빌드에서만 render 하지만 real 번들에 코드는 포함.
 *
 * 수정:
 *  - lazy() + Suspense 패턴으로 dynamic import 전환.
 *  - real 빌드에서 devtools 가 별도 chunk 로 분리되어 isDev=false 시 절대 fetch 안 됨.
 *
 * 검증:
 *  pnpm build:real 결과 index 번들에서 devtools 코드 빠짐.
 */
console.log('Cycle 42 — ReactQueryDevtools dynamic import')
console.log('')
console.log('수정: lazy() + Suspense fallback={null} 패턴.')
console.log('영향: real 빌드의 main index chunk 에서 ~60KB devtools 코드 제거.')
