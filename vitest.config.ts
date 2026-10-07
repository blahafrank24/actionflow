import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts', 'demo/**/*.test.ts'],
    typecheck: { checker: 'vue-tsc', include: ['src/**/*.test-d.ts', 'tests/**/*.test-d.ts'] },
  },
});
