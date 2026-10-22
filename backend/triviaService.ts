import { randomUUID } from 'node:crypto';
import {
  MAX_GENERATION_ATTEMPTS,
  MAX_TOPIC_LENGTH,
  MODEL_CALL_TIMEOUT_MS,
  TOTAL_DEADLINE_MS,
} from './config.ts';
import { AiError, toAiError, type AiClient } from './openaiClient.ts';
import {
  normalizeText,
  validQuestionSchema,
  type AgeGroup,
  type QuestionOption,
  type ValidQuestion,
} from './questionSchema.ts';

export type TriviaErrorCode =
  | 'empty_topic'
  | 'topic_too_long'
  | 'unclear_topic'
  | 'unsuitable_topic'
  | 'no_valid_question'
  | 'timeout'
  | 'rate_limited'
  | 'budget_exhausted'
  | 'provider_error';

export interface GeneratedQuestion {
  questionId: string;
  prompt: string;
  options: QuestionOption[];
  correctOptionId: string;
  explanation: string;
}

export type TriviaResult =
  | { ok: true; question: GeneratedQuestion; attempts: number; tokens: number }
  | { ok: false; code: TriviaErrorCode; attempts: number; tokens: number };

export interface TriviaOptions {
  deadlineMs?: number;
  callTimeoutMs?: number;
  random?: () => number;
}

const OPTION_IDS = ['a', 'b', 'c', 'd'];

// Fisher–Yates shuffle, then assigns stable ids a–d.
export function shuffleQuestion(candidate: ValidQuestion, random: () => number = Math.random) {
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const options = order.map((source, index) => ({
    id: OPTION_IDS[index],
    text: candidate.options[source].trim(),
  }));
  const correctOptionId = OPTION_IDS[order.indexOf(candidate.correctIndex)];
  return { options, correctOptionId };
}

// Pipeline per ARCHITECTURE.md §6: normalize → input moderation → generate → Zod → output moderation
// → at most one fallback attempt → shuffle. Duplicate checks against previous questions arrive in M3.
export async function generateTriviaQuestion(
  ai: AiClient,
  ageGroup: AgeGroup,
  rawTopic: string,
  options: TriviaOptions = {},
): Promise<TriviaResult> {
  const deadline = Date.now() + (options.deadlineMs ?? TOTAL_DEADLINE_MS);
  const callTimeout = options.callTimeoutMs ?? MODEL_CALL_TIMEOUT_MS;
  let attempts = 0;
  let tokens = 0;
  const fail = (code: TriviaErrorCode): TriviaResult => ({ ok: false, code, attempts, tokens });

  const topic = normalizeText(rawTopic);
  if (!topic) return fail('empty_topic');
  if (topic.length > MAX_TOPIC_LENGTH) return fail('topic_too_long');

  // Each call gets the per-call timeout, capped by what is left of the total deadline.
  const callSignal = () => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new AiError('timeout');
    return AbortSignal.timeout(Math.min(callTimeout, remaining));
  };

  try {
    if (await ai.moderate([topic], callSignal())) return fail('unsuitable_topic');

    while (attempts < MAX_GENERATION_ATTEMPTS) {
      attempts++;
      const result = await ai.generate(ageGroup, topic, callSignal());
      tokens += result.tokens;
      const output = result.output;
      if (output?.status === 'unsuitable_topic') return fail('unsuitable_topic');
      if (output?.status === 'unclear_topic') return fail('unclear_topic');

      const parsed = validQuestionSchema.safeParse(output);
      if (!parsed.success) continue;
      const candidate = parsed.data;

      const flagged = await ai.moderate(
        [candidate.question, ...candidate.options, candidate.explanation],
        callSignal(),
      );
      if (flagged) continue;

      const { options: shuffled, correctOptionId } = shuffleQuestion(candidate, options.random);
      return {
        ok: true,
        attempts,
        tokens,
        question: {
          questionId: randomUUID(),
          prompt: candidate.question.trim(),
          options: shuffled,
          correctOptionId,
          explanation: candidate.explanation.trim(),
        },
      };
    }
    return fail('no_valid_question');
  } catch (error) {
    return fail(toAiError(error).kind);
  }
}
