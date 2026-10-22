/// <reference types="vitest/config" />
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
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

export default defineConfig({
  plugins: [react(), localApi()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
