import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      {
        name: 'serve-local-ort-wasm',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const reqUrl = req.url?.split('?')[0] ?? '';
            if (reqUrl.startsWith('/ort-wasm/')) {
              const fileName = path.basename(reqUrl);
              const filePath = path.resolve(__dirname, 'public/ort-wasm', fileName);
              if (fs.existsSync(filePath)) {
                const ext = path.extname(fileName).toLowerCase();
                res.setHeader(
                  'Content-Type',
                  ext === '.wasm'
                    ? 'application/wasm'
                    : ext === '.mjs' || ext === '.js'
                      ? 'text/javascript; charset=utf-8'
                      : 'application/octet-stream'
                );
                fs.createReadStream(filePath).pipe(res);
                return;
              }
            }
            next();
          });
        },
      },
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'icon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'Masterson Case Digital',
          short_name: 'Masterson',
          description:
            'Offline-first equine bodywork evaluation, anatomical diagramming, local Whisper voice transcription, and case study notebook for The Masterson Method.',
          theme_color: '#2B4C3F',
          background_color: '#FAF9F6',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpeg,jpg,mjs}'],
          globIgnores: ['**/assets/aistudio/*.zip', '**/ort-wasm/*.wasm'],
          maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: /\/ort-wasm\/.*\.(wasm|mjs)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'local-ort-wasm-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        injectRegister: false,
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom/client',
        'dexie',
        'lucide-react',
        '@huggingface/transformers',
      ],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
