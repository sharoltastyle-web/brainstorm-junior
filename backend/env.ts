import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Server-only secret loading. Never import this module from src/.
export const ENV_FILE_PATH = fileURLToPath(new URL('./.env', import.meta.url));

export function loadServerEnv(path: string = ENV_FILE_PATH): void {
  // On Vercel the key comes from the platform environment. Checking VERCEL (not NODE_ENV)
  // keeps the local `vite preview` build, which runs with NODE_ENV=production, working.
  if (process.env.VERCEL) return;
  if (!existsSync(path)) return;
  process.loadEnvFile(path);
}

// Returns only whether a key is present; the value is never exposed.
export function hasOpenAiKey(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return typeof key === 'string' && key.trim().length > 0;
}
