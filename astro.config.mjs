// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import UnoCSS from 'unocss/astro';
import AstroPWA from '@vite-pwa/astro';

// https://astro.build/config
export default defineConfig({
  integrations: [
    preact({ compat: true }),
    UnoCSS({ injectReset: true }),
    AstroPWA({
      registerType: 'autoUpdate',
      workbox: {
        // Cache all static assets including WASM
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,wasm}'],
        // Increase limit for large Shiki core bundle
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        runtimeCaching: [
          {
            // Special handling for WASM files (Shiki)
            urlPattern: ({ url }) => url.pathname.endsWith('.wasm'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'wasm-cache',
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Cache Shiki core bundle
            urlPattern: ({ url }) => url.pathname.includes('shiki'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'shiki-cache',
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Offline Docs',
        short_name: 'OfflineDocs',
        description: 'Offline markdown preview and editor',
        start_url: '/',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
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
