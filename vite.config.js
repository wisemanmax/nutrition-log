import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Inline CSS plugin — embeds all CSS directly into index.html for offline-first PWA
function inlineCssPlugin() {
  return {
    name: 'inline-css',
    enforce: 'post',
    generateBundle(_, bundle) {
      const cssFiles = [];
      for (const [name, chunk] of Object.entries(bundle)) {
        if (name.endsWith('.css')) { cssFiles.push({ name, source: chunk.source }); }
      }
      for (const [name, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'asset' && name.endsWith('.html')) {
          let html = chunk.source;
          for (const css of cssFiles) {
            const linkRegex = new RegExp(`<link[^>]*href=["'][^"']*${css.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*/?>`);
            html = html.replace(linkRegex, `<style>${css.source}</style>`);
          }
          chunk.source = html;
        }
      }
      for (const css of cssFiles) delete bundle[css.name];
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), inlineCssPlugin()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  server: { port: 3004 },
});
