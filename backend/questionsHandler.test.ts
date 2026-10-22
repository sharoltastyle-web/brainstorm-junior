// @vitest-environment node
import { handleQuestions, MAX_BODY_BYTES } from './questionsHandler.ts';

const FAKE_KEY = 'sk-test-fake-key-for-unit-tests-only';
const validRequest = {
  method: 'POST',
  contentType: 'application/json',
  body: JSON.stringify({ ageGroup: '6-8', topic: 'חלל', requestId: 'req-1' }),
};

describe('handleQuestions', () => {
  const originalKey = process.env.OPENAI_API_KEY;
  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it('rejects non-POST methods', () => {
    expect(handleQuestions({ ...validRequest, method: 'GET' }).status).toBe(405);
  });

  it('rejects non-JSON content types', () => {
    expect(handleQuestions({ ...validRequest, contentType: 'text/plain' }).status).toBe(415);
  });

  it('rejects invalid JSON', () => {
    expect(handleQuestions({ ...validRequest, body: '{oops' }).status).toBe(400);
  });

  it('rejects oversized bodies', () => {
    const body = JSON.stringify({ topic: 'x'.repeat(MAX_BODY_BYTES) });
    expect(handleQuestions({ ...validRequest, body }).status).toBe(413);
  });

  it('reports a missing key without leaking anything', () => {
    delete process.env.OPENAI_API_KEY;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = handleQuestions(validRequest);
    expect(result.status).toBe(503);
    expect(result.json).toEqual({
      error: {
        code: 'not_configured',
        message: 'שירות השאלות עדיין לא מוגדר.',
        retryable: false,
        requestId: 'req-1',
      },
    });
    expect(warn).toHaveBeenCalledWith('[questions] OPENAI_API_KEY missing');
  });

  it('answers "not available yet" when the key is loaded, never echoing it', () => {
    process.env.OPENAI_API_KEY = FAKE_KEY;
    const logs: unknown[] = [];
    for (const level of ['log', 'info', 'warn', 'error'] as const) {
      vi.spyOn(console, level).mockImplementation((...args) => logs.push(...args));
    }
    const result = handleQuestions(validRequest);
    expect(result.status).toBe(503);
    expect((result.json as { error: { code: string } }).error.code).toBe('not_available_yet');
    expect(JSON.stringify(result)).not.toContain(FAKE_KEY);
    expect(JSON.stringify(logs)).not.toContain(FAKE_KEY);
  });

  it('always sends no-store', () => {
    expect(handleQuestions(validRequest).headers['Cache-Control']).toBe('no-store');
    expect(handleQuestions({ ...validRequest, method: 'GET' }).headers['Cache-Control']).toBe('no-store');
  });
});
