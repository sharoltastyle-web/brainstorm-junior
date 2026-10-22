// Non-secret backend configuration (ARCHITECTURE.md §8). The only secret is OPENAI_API_KEY, read from the environment.

export const MODEL = 'gpt-5.4-mini-2026-03-17';
export const MODERATION_MODEL = 'omni-moderation-latest';

export const MAX_TOPIC_LENGTH = 120;
export const MAX_PREVIOUS_QUESTIONS = 20;
export const MAX_BODY_BYTES = 16 * 1024;

// Includes reasoning tokens; reasoning effort is kept low to shorten the wait.
export const MAX_OUTPUT_TOKENS = 1600;
export const REASONING_EFFORT = 'low' as const;

export const TOTAL_DEADLINE_MS = 30_000;
export const MODEL_CALL_TIMEOUT_MS = 20_000;
export const MAX_GENERATION_ATTEMPTS = 2;

// Not proof of a ZDR agreement. Must stay false until ZDR is verified in the actual account (M5).
// Until then the app runs locally only and is tested by adults with synthetic topics.
export const CHILD_USE_APPROVED = false;
