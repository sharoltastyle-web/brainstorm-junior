/// <reference types="vitest/config" />
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { loadServerEnv } from './backend/env.ts';
import { handleQuestions, MAX_BODY_BYTES } from './backend/questionsHandler.ts';

const QUESTIONS_PATH = '/api/v1/questions';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      // Stop buffering past the limit; the handler rejects oversized bodies.
      if (size <= MAX_BODY_BYTES + 1) chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function questionsMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
): Promise<void> {
  if (req.url?.split('?')[0] !== QUESTIONS_PATH) return next();
  const body = req.method === 'POST' ? await readBody(req) : '';
  const result = await handleQuestions({
    method: req.method ?? 'GET',
    contentType: req.headers['content-type'] ?? null,
    origin: req.headers.origin ?? null,
    host: req.headers.host ?? null,
    body,
  });
  res.statusCode = result.status;
  for (const [name, value] of Object.entries(result.headers)) res.setHeader(name, value);
  res.end(JSON.stringify(result.json));
}

// Runs the same backend handler locally (dev and preview), so no Vercel account is needed before M5.
function localApi(): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      loadServerEnv();
      server.middlewares.use((req, res, next) => void questionsMiddleware(req, res, next).catch(next));
    },
    configurePreviewServer(server) {
      loadServerEnv();
      server.middlewares.use((req, res, next) => void questionsMiddleware(req, res, next).catch(next));
    },
  };
}

// Installable shell with offline support (ARCHITECTURE §10). Only build files are precached;
// the API is never cached and never answered with the app shell. The service worker is off in dev.
function pwa() {
  return VitePWA({
    // 'prompt' without UI: a new version waits until all app tabs are closed, so there is no forced reload mid-game.
    registerType: 'prompt',
    injectRegister: 'auto',
    // Icons are already matched by globPatterns below; listing them again would precache them twice.
    includeManifestIcons: false,
    manifest: {
      id: '/',
      name: "BrainStorm ג'וניור",
      short_name: 'BrainStorm',
      description: 'משחק טריוויה לגילי 6 עד 12. מגלים דברים חדשים בנושאים שמעניינים אתכם.',
      lang: 'he',
      dir: 'rtl',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: '#22C7F2',
      background_color: '#F3FAFF',
      icons: [
        { src: '/images/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
        { src: '/images/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/images/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/images/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      // woff2 only: every PWA-capable browser uses it, so the older .woff files are not precached.
      globPatterns: ['**/*.{js,css,html,png,ico,woff2,webmanifest}'],
      // The 1024px source icon is only an input for the generated icons; the app never loads it.
      globIgnores: ['images/app-icon.png'],
      // background.png is about 1.5 MB, above Workbox's 2 MB default only with headroom.
      maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      navigateFallback: '/index.html',
      navigateFallbackDenylist: [/^\/api\//],
      cleanupOutdatedCaches: true,
      runtimeCaching: [
        { urlPattern: ({ url }) => url.pathname.startsWith('/api/'), handler: 'NetworkOnly', method: 'POST' },
        { urlPattern: ({ url }) => url.pathname.startsWith('/api/'), handler: 'NetworkOnly', method: 'GET' },
      ],
    },
  });
}

export default defineConfig({
  plugins: [react(), localApi(), pwa()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
