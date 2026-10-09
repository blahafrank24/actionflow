import { resolve } from 'node:path';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      {
        find: /^@yung_papa\/actionflow$/,
        replacement: resolve(import.meta.dirname, 'src/core/index.ts'),
      },
      {
        find: /^@yung_papa\/actionflow\/openapi$/,
        replacement: resolve(import.meta.dirname, 'src/openapi/index.ts'),
      },
    ],
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts', 'demo/**/*.test.ts'],
    typecheck: { checker: 'vue-tsc', include: ['src/**/*.test-d.ts', 'tests/**/*.test-d.ts'] },
  },
});
