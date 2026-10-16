import { fileURLToPath } from 'node:url';
import legacy from '@vitejs/plugin-legacy';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [legacy({ targets: ['ie 11'] })],
  build: {
    // IE11 output must remain ES5 through minification as well as Babel.
    minify: 'terser',
    terserOptions: { ecma: 5, format: { ecma: 5 } },
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        probe: fileURLToPath(new URL('./probe.html', import.meta.url)),
        project: fileURLToPath(new URL('./project.html', import.meta.url)),
      },
    },
  },
});
