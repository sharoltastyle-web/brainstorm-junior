import { hasOpenAiKey } from './env.ts';

export interface HandlerRequest {
  method: string;
  contentType: string | null;
  body: string;
}

export interface HandlerResponse {
  status: number;
  headers: Record<string, string>;
  json: unknown;
}

export const MAX_BODY_BYTES = 16 * 1024;

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
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

// Environment-neutral handler shared by the Vite dev middleware and the Vercel Function.
// M1: question generation is not implemented yet; it is added in M2.
export function handleQuestions(req: HandlerRequest): HandlerResponse {
  if (req.method !== 'POST') {
    return errorResponse(405, 'method_not_allowed', 'הבקשה אינה נתמכת.', false, null, {
      Allow: 'POST',
    });
  }

  if (!req.contentType || !req.contentType.toLowerCase().startsWith('application/json')) {
    return errorResponse(415, 'unsupported_media_type', 'הבקשה אינה נתמכת.', false, null);
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

  if (!hasOpenAiKey()) {
    console.warn('[questions] OPENAI_API_KEY missing');
    return errorResponse(503, 'not_configured', 'שירות השאלות עדיין לא מוגדר.', false, requestId);
  }

  return errorResponse(503, 'not_available_yet', 'יצירת שאלות תהיה זמינה בקרוב.', false, requestId);
}
