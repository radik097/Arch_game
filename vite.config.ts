import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react()],
  test: {
    globals: true,
    setupFiles: 'src/test/setup.ts',
    environmentMatchGlobs: [
      ['**/*.server.test.ts', 'node'],
      ['server/**/*.test.ts', 'node'],
      ['**/*.test.ts', 'jsdom'],
      ['**/*.test.tsx', 'jsdom'],
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');

          if (/\/node_modules\/(react|react-dom|react-router|react-router-dom)\//.test(normalizedId)) {
            return 'vendor-react';
          }

          if (normalizedId.includes('/node_modules/@xterm/')) {
            return 'vendor-terminal';
          }

          if (normalizedId.includes('/src/features/simulator/')) {
            return 'feature-simulator';
          }

          return undefined;
        },
      },
    },
  },
});
