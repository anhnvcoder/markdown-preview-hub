// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import UnoCSS from 'unocss/astro';

// https://astro.build/config
export default defineConfig({
  integrations: [
    preact({ compat: true }),
    UnoCSS({ injectReset: true }),
  ],
  output: 'static',
  vite: {
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Shiki langs lazy loaded separately
            if (id.includes('shiki/dist/langs')) {
              const match = id.match(/langs\/([^.]+)/);
              return match ? `shiki-lang-${match[1]}` : 'shiki-langs';
            }
            if (id.includes('shiki/dist/themes')) {
              return 'shiki-themes';
            }
            if (id.includes('shiki')) {
              return 'shiki-core';
            }
            if (id.includes('markdown-it')) {
              return 'markdown-it';
            }
          },
        },
      },
    },
  },
});
