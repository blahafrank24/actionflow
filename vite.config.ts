import { resolve } from 'node:path';
import dts from 'vite-plugin-dts';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    dts({
      include: ['src'],
      entryRoot: 'src',
      exclude: ['**/*.test.ts', '**/*.test-d.ts', 'src/openapi/fixture.ts'],
    }),
  ],
  build: {
    lib: {
      entry: {
        core: resolve(import.meta.dirname, 'src/core/index.ts'),
        openapi: resolve(import.meta.dirname, 'src/openapi/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: { external: ['openapi-fetch'] },
  },
});
