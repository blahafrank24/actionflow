import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: /^actionflow$/, replacement: resolve(import.meta.dirname, 'src/core/index.ts') },
      {
        find: /^actionflow\/openapi$/,
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
