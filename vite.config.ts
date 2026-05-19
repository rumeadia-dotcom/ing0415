import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// MarketCast — Stage A bootstrap.
// GitHub Pages 정적 호스팅 + 404.html fallback 패턴 전제로 base 는 './' 사용.
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
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
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
