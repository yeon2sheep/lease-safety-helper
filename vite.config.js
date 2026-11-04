import { defineConfig } from 'vite';

// GitHub Pages 배포 시 상대 경로로 동작하도록 base를 './'로 둔다.
export default defineConfig({
  base: '/lease-safety-helper/',
  // pdf.js는 ESM + top-level await를 쓰므로 사전 번들링에서 제외하고 최신 타깃으로 빌드한다.
  optimizeDeps: { exclude: ['pdfjs-dist'] },
  build: { target: 'es2022' },
  esbuild: { target: 'es2022' },
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    testTimeout: 20000
  }
});
