import { resolve } from 'node:path';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const src = resolve(import.meta.dirname, '../src');

export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [vue()],
  resolve: {
    alias: [
      { find: /^@yung_papa\/actionflow$/, replacement: resolve(src, 'core/index.ts') },
      { find: /^@yung_papa\/actionflow\/openapi$/, replacement: resolve(src, 'openapi/index.ts') },
    ],
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
