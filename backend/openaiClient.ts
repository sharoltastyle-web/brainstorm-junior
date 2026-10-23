import OpenAI from 'openai';
import {
  MAX_OUTPUT_TOKENS,
  MODEL,
  MODERATION_MODEL,
  REASONING_EFFORT,
} from './config.js';
import { buildInstructions, buildUserInput } from './prompts.js';
import {
  MODEL_OUTPUT_JSON_SCHEMA,
  modelOutputSchema,
  type AgeGroup,
  type ModelOutput,
} from './questionSchema.js';

export type AiErrorKind = 'timeout' | 'rate_limited' | 'budget_exhausted' | 'provider_error';

export class AiError extends Error {
  readonly kind: AiErrorKind;
  constructor(kind: AiErrorKind) {
    super(kind);
    this.kind = kind;
  }
}

export interface GenerationResult {
  // null when the model refused, stopped early or returned unparseable output.
  output: ModelOutput | null;
  tokens: number;
}

// Injectable AI boundary so tests can use fixtures without network or a key.
export interface AiClient {
  generate(
    ageGroup: AgeGroup,
    topic: string,
    previousQuestions: string[],
    signal: AbortSignal,
  ): Promise<GenerationResult>;
  // Returns true when any of the texts is flagged.
  moderate(texts: string[], signal: AbortSignal): Promise<boolean>;
}

// Maps SDK errors to internal kinds; raw provider messages never leave this module.
export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (
    error instanceof OpenAI.APIUserAbortError ||
    error instanceof OpenAI.APIConnectionTimeoutError ||
    (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError'))
  ) {
    return new AiError('timeout');
  }
  if (error instanceof OpenAI.RateLimitError) {
    return new AiError(error.code === 'insufficient_quota' ? 'budget_exhausted' : 'rate_limited');
  }
  return new AiError('provider_error');
}

export function createOpenAiClient(): AiClient {
  // The key is read at call time from the server environment only.
  let client: OpenAI | null = null;
  const getClient = () => (client ??= new OpenAI({ maxRetries: 0 }));

  return {
    async generate(ageGroup, topic, previousQuestions, signal) {
      try {
        const response = await getClient().responses.create(
          {
            model: MODEL,
            store: false,
            instructions: buildInstructions(ageGroup),
            input: buildUserInput(topic, previousQuestions),
            max_output_tokens: MAX_OUTPUT_TOKENS,
            reasoning: { effort: REASONING_EFFORT },
            text: {
              format: {
                type: 'json_schema',
                name: 'trivia_question',
                strict: true,
                schema: MODEL_OUTPUT_JSON_SCHEMA as unknown as Record<string, unknown>,
              },
            },
          },
          { signal },
        );
        const tokens = response.usage?.total_tokens ?? 0;
        const refused = response.output.some(
          (item) => item.type === 'message' && item.content.some((part) => part.type === 'refusal'),
        );
        if (refused || response.status !== 'completed') return { output: null, tokens };
        let json: unknown;
        try {
          json = JSON.parse(response.output_text);
        } catch {
          return { output: null, tokens };
        }
        const parsed = modelOutputSchema.safeParse(json);
        return { output: parsed.success ? parsed.data : null, tokens };
      } catch (error) {
        throw toAiError(error);
      }
    },

    async moderate(texts, signal) {
      try {
        const result = await getClient().moderations.create(
          { model: MODERATION_MODEL, input: texts },
          { signal },
        );
        return result.results.some((item) => item.flagged);
      } catch (error) {
        throw toAiError(error);
      }
    },
  };
}
