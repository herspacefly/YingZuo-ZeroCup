import { fileURLToPath } from 'node:url';
import legacy from '@vitejs/plugin-legacy';
import { defineConfig } from 'vite';
import { renderMuseumPage } from './src/content/museum-page';

export default defineConfig({
  base: './',
  plugins: [{
    name: 'museum-readable-page',
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        return context.filename.endsWith('/museum.html') || context.filename.endsWith('\\museum.html')
          ? html.replace('<!-- museum-content -->', renderMuseumPage()) : html;
      },
    },
  }, legacy({ targets: ['ie 11'] }), {
    name: 'museum-without-runtime',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        // CSS-only entries otherwise receive Vite's module and legacy loaders.
        if (!/[/\\]museum\.html$/.test(context.filename)) return html;
        return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<link\b[^>]*rel="modulepreload"[^>]*>/gi, '');
      },
    },
  }],
  build: {
    // IE11 output must remain ES5 through minification as well as Babel.
    minify: 'terser',
    terserOptions: { ecma: 5, format: { ecma: 5 } },
    rollupOptions: {
      input: {
        museum: fileURLToPath(new URL('./museum.html', import.meta.url)),
        credits: fileURLToPath(new URL('./credits.html', import.meta.url)),
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        study: fileURLToPath(new URL('./study.html', import.meta.url)),
        probe: fileURLToPath(new URL('./probe.html', import.meta.url)),
        project: fileURLToPath(new URL('./project.html', import.meta.url)),
        assets: fileURLToPath(new URL('./assets.html', import.meta.url)),
        story: fileURLToPath(new URL('./story.html', import.meta.url)),
      },
    },
  },
});
