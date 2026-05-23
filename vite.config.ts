import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// MarketCast — Stage A bootstrap.
// GitHub Pages 정적 호스팅 + 404.html fallback 패턴.
//
// base 전략:
//   - 로컬 dev/preview: VITE_BASE_PATH 미설정 → './' (루트 서빙)
//   - GitHub Pages 배포: VITE_BASE_PATH=/ing0415/ → '/ing0415/' (subpath 서빙)
//   deploy.yml 의 build-real 잡에서 VITE_BASE_PATH 를 주입한다.
//
// 디렉토리 구조 (2026-05-19 모노레포 정리):
//   - root:  ./apps/web/   (frontend, vite root)
//   - root:  ./apps/api/   (backend, supabase CLI workdir)
// vite root 를 apps/web 으로 두고 build outDir 는 프로젝트 루트의 dist/ 로 끌어올린다
// (GitHub Pages 배포 잡과 postbuild-spa.mjs 가 dist/ 를 그대로 사용).
const WEB_ROOT = path.resolve(__dirname, 'apps/web')

export default defineConfig({
  root: WEB_ROOT,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(WEB_ROOT, 'src'),
    },
  },
  base: process.env['VITE_BASE_PATH'] ?? './',
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        /**
         * 매뉴얼 chunk 분리 (loop 사이클 5, 2026-05-23).
         * 이전: 메인 index.js = 1.3 MB (모든 의존성 + 모든 라우트 통합).
         * 이후: vendor chunk 별 분리 → 초기 로드 시 main 만 receive,
         *       무거운 라이브러리 (Tiptap / Supabase) 는 사용 라우트 진입 시.
         */
        manualChunks: {
          // React 코어 — 모든 페이지 공통, 가벼움 (~50KB)
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // 데이터 레이어 — 모든 페이지 공통
          'data-vendor': ['@tanstack/react-query', '@supabase/supabase-js', 'zod'],
          // WYSIWYG 에디터 — s3 등록 화면 한정 (Tiptap + StarterKit + Link + Image)
          'editor-vendor': [
            '@tiptap/react',
            '@tiptap/starter-kit',
            '@tiptap/extension-link',
            '@tiptap/extension-image',
            '@tiptap/extension-placeholder',
          ],
          // 보안 sanitize — s3 등록 화면 한정
          'security-vendor': ['dompurify'],
          // 폼 + UI 라이브러리 — 여러 화면 공통
          'ui-vendor': [
            'react-hook-form',
            '@hookform/resolvers',
            'sonner',
            'lucide-react',
            'class-variance-authority',
            'clsx',
            'tailwind-merge',
          ],
          // Sentry — 운영 모니터링 (lazy 불가, 초기 import)
          'sentry-vendor': ['@sentry/react'],
        },
      },
    },
  },
  server: {
    port: 5174,
    strictPort: false,
  },
  preview: {
    port: 5174,
    strictPort: false,
  },
})
