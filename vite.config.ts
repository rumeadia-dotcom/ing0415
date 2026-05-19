import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// MarketCast — Stage A bootstrap.
// GitHub Pages 정적 호스팅 + 404.html fallback 패턴 전제로 base 는 './' 사용.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  base: './',
  server: {
    port: 5174,
    strictPort: false,
  },
  preview: {
    port: 5174,
    strictPort: false,
  },
})
