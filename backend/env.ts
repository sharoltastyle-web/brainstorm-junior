import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Server-only secret loading. Never import this module from src/.
export const ENV_FILE_PATH = fileURLToPath(new URL('./.env', import.meta.url));

export function loadServerEnv(path: string = ENV_FILE_PATH): void {
  // In production (Vercel) the key comes from the platform environment.
  if (process.env.NODE_ENV === 'production') return;
  if (!existsSync(path)) return;
  process.loadEnvFile(path);
}

// Returns only whether a key is present; the value is never exposed.
export function hasOpenAiKey(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return typeof key === 'string' && key.trim().length > 0;
}
