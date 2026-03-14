import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  assetsInclude: ['**/*.wasm', '**/*.img', '**/*.iso', '**/*.ext2'],
  plugins: [react()],
  test: {
    environment: 'node',
  },
});
