import type { AgeGroup } from '../state/GameContext';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  questionId: string;
  prompt: string;
  options: QuestionOption[];
  correctOptionId: string;
  explanation: string;
}

export type FetchQuestionResult = { ok: true; question: Question } | { ok: false; message: string };

export interface QuestionRequest {
  ageGroup: AgeGroup;
  topic: string;
  requestId: string;
  previousQuestions: string[];
}

export const GENERIC_ERROR = 'משהו השתבש. נסו שוב.';
export const OFFLINE_ERROR = 'כדי לקבל שאלה, צריך להתחבר לאינטרנט.';

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}
// Slightly above the server's 30s deadline, so loading never hangs.
export const CLIENT_TIMEOUT_MS = 35_000;

function isQuestion(data: unknown): data is Question {
  if (!data || typeof data !== 'object') return false;
  const value = data as Partial<Question>;
  return (
    typeof value.questionId === 'string' &&
    typeof value.prompt === 'string' &&
    typeof value.explanation === 'string' &&
    typeof value.correctOptionId === 'string' &&
    Array.isArray(value.options) &&
    value.options.length === 4 &&
    value.options.every((option) => typeof option?.id === 'string' && typeof option?.text === 'string') &&
    value.options.some((option) => option.id === value.correctOptionId)
  );
}

export async function fetchQuestion(request: QuestionRequest): Promise<FetchQuestionResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  try {
    const response = await fetch('/api/v1/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    const data: unknown = await response.json().catch(() => null);
    if (response.ok) {
      return isQuestion(data) ? { ok: true, question: data } : { ok: false, message: GENERIC_ERROR };
    }
    const message =
      data && typeof data === 'object' && 'error' in data
        ? (data as { error: { message?: unknown } }).error?.message
        : null;
    return { ok: false, message: typeof message === 'string' ? message : GENERIC_ERROR };
  } catch {
    // A network failure while the browser is offline gets the connection message.
    return { ok: false, message: isOffline() ? OFFLINE_ERROR : GENERIC_ERROR };
  } finally {
    clearTimeout(timer);
  }
}
