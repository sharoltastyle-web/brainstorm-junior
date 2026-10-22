import { MAX_BODY_BYTES } from './config.ts';
import { hasOpenAiKey } from './env.ts';
import { createOpenAiClient, type AiClient } from './openaiClient.ts';
import { questionRequestSchema, type QuestionResponse } from './questionSchema.ts';
import { generateTriviaQuestion, type TriviaErrorCode } from './triviaService.ts';

export { MAX_BODY_BYTES };

export interface HandlerRequest {
  method: string;
  contentType: string | null;
  origin: string | null;
  host: string | null;
  body: string;
}

export interface HandlerResponse {
  status: number;
  headers: Record<string, string>;
  json: unknown;
}

export interface HandlerDeps {
  ai?: AiClient;
  deadlineMs?: number;
}

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const RETRY_LATER = 'משהו השתבש. נסו שוב.';
const OTHER_TOPIC = 'בואו נבחר נושא אחר וננסה שוב.';

const TRIVIA_ERRORS: Record<TriviaErrorCode, { status: number; message: string; retryable: boolean }> = {
  empty_topic: { status: 400, message: 'צריך להקליד נושא כדי לקבל שאלה.', retryable: false },
  topic_too_long: { status: 400, message: 'הנושא ארוך מדי. נסו לקצר אותו.', retryable: false },
  unclear_topic: { status: 422, message: OTHER_TOPIC, retryable: false },
  unsuitable_topic: { status: 422, message: OTHER_TOPIC, retryable: false },
  no_valid_question: {
    status: 503,
    message: 'לא הצלחנו להכין שאלה כרגע. נסו שוב או בחרו נושא אחר.',
    retryable: true,
  },
  timeout: { status: 503, message: 'לקח יותר מדי זמן. נסו שוב בעוד רגע.', retryable: true },
  rate_limited: { status: 429, message: 'יש עומס כרגע. נסו שוב בעוד רגע.', retryable: true },
  budget_exhausted: {
    status: 503,
    message: 'אי אפשר לקבל שאלות כרגע. נסו שוב מאוחר יותר.',
    retryable: false,
  },
  provider_error: { status: 503, message: RETRY_LATER, retryable: true },
};

function errorResponse(
  status: number,
  code: string,
  message: string,
  retryable: boolean,
  requestId: string | null,
  extraHeaders: Record<string, string> = {},
): HandlerResponse {
  return {
    status,
    headers: { ...BASE_HEADERS, ...extraHeaders },
    json: { error: { code, message, retryable, requestId } },
  };
}

function readRequestId(parsed: unknown): string | null {
  if (parsed && typeof parsed === 'object' && 'requestId' in parsed) {
    const value = (parsed as { requestId: unknown }).requestId;
    if (typeof value === 'string' && value.length <= 100) return value;
  }
  return null;
}

// Same-origin check: a browser Origin must match the Host the request was sent to.
// This is not authentication (ARCHITECTURE.md §7).
function isAllowedOrigin(origin: string | null, host: string | null): boolean {
  if (!origin) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// Logs carry only code, timing and usage — never the topic, the question or the key.
function logResult(code: string, startedAt: number, attempts = 0, tokens = 0): void {
  console.info(
    `[questions] code=${code} ms=${Date.now() - startedAt} attempts=${attempts} tokens=${tokens}`,
  );
}

let defaultAi: AiClient | null = null;

// Environment-neutral handler shared by the Vite dev middleware and the Vercel Function.
export async function handleQuestions(
  req: HandlerRequest,
  deps: HandlerDeps = {},
): Promise<HandlerResponse> {
  const startedAt = Date.now();

  if (req.method !== 'POST') {
    return errorResponse(405, 'method_not_allowed', 'הבקשה אינה נתמכת.', false, null, {
      Allow: 'POST',
    });
  }

  if (!req.contentType || !req.contentType.toLowerCase().startsWith('application/json')) {
    return errorResponse(415, 'unsupported_media_type', 'הבקשה אינה נתמכת.', false, null);
  }

  if (!isAllowedOrigin(req.origin, req.host)) {
    return errorResponse(403, 'forbidden_origin', 'הבקשה אינה נתמכת.', false, null);
  }

  if (Buffer.byteLength(req.body, 'utf8') > MAX_BODY_BYTES) {
    return errorResponse(413, 'payload_too_large', 'הבקשה ארוכה מדי. נסו לקצר את הנושא.', false, null);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(req.body);
  } catch {
    return errorResponse(400, 'invalid_json', 'משהו השתבש בבקשה. נסו שוב.', false, null);
  }
  const requestId = readRequestId(parsed);

  const input = questionRequestSchema.safeParse(parsed);
  if (!input.success) {
    return errorResponse(400, 'invalid_request', 'משהו השתבש בבקשה. נסו שוב.', false, requestId);
  }

  if (!hasOpenAiKey()) {
    console.warn('[questions] OPENAI_API_KEY missing');
    return errorResponse(503, 'not_configured', 'שירות השאלות עדיין לא מוגדר.', false, requestId);
  }

  const ai = deps.ai ?? (defaultAi ??= createOpenAiClient());
  const result = await generateTriviaQuestion(ai, input.data.ageGroup, input.data.topic, {
    deadlineMs: deps.deadlineMs,
  });
  logResult(result.ok ? 'ok' : result.code, startedAt, result.attempts, result.tokens);

  if (!result.ok) {
    const { status, message, retryable } = TRIVIA_ERRORS[result.code];
    return errorResponse(status, result.code, message, retryable, input.data.requestId);
  }

  const json: QuestionResponse = { requestId: input.data.requestId, ...result.question };
  return { status: 200, headers: { ...BASE_HEADERS }, json };
}
