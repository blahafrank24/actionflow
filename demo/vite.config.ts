import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [vue()],
  build: { outDir: 'dist', emptyOutDir: true },
});
