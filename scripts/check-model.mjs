// Checks that the configured model is available for the key in backend/.env. Never prints the key.
import OpenAI from 'openai';
import { loadServerEnv, hasOpenAiKey } from '../backend/env.ts';
import { MODEL } from '../backend/config.ts';

loadServerEnv();
if (!hasOpenAiKey()) {
  console.error('check-model: OPENAI_API_KEY is missing in backend/.env');
  process.exit(1);
}

try {
  const client = new OpenAI({ maxRetries: 0, timeout: 20_000 });
  await client.models.retrieve(MODEL);
  console.log(`check-model: ${MODEL} available`);
} catch (error) {
  const status = error && typeof error === 'object' && 'status' in error ? error.status : 'network';
  const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
  console.error(`check-model: FAILED (status=${status}${code ? ` code=${code}` : ''})`);
  process.exit(1);
}
