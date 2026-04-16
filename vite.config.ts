import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

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
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-terminal': ['@xterm/xterm', '@xterm/addon-fit'],
          'vendor-v86': ['v86'],
          'feature-simulator': [
            './src/features/simulator/SimulatorEngine',
            './src/features/simulator/installationFSM',
          ],
        },
      },
    },
  },
});
