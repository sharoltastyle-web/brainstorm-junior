// @vitest-environment node
import { validOutput, threeOptions } from './fixtures/modelOutputs.js';
import { handleQuestions, MAX_BODY_BYTES, type HandlerRequest } from './questionsHandler.js';
import { fakeAi } from './testing/fakeAi.js';

const FAKE_KEY = 'sk-test-fake-key-for-unit-tests-only';
const validRequest: HandlerRequest = {
  method: 'POST',
  contentType: 'application/json',
  origin: 'http://localhost:5173',
  host: 'localhost:5173',
  body: JSON.stringify({ ageGroup: '6-8', topic: 'חלל', requestId: 'req-1' }),
};
const withBody = (body: unknown): HandlerRequest => ({ ...validRequest, body: JSON.stringify(body) });
const errorCode = (json: unknown) => (json as { error: { code: string } }).error.code;

describe('handleQuestions', () => {
  const originalKey = process.env.OPENAI_API_KEY;
  beforeEach(() => {
    process.env.OPENAI_API_KEY = FAKE_KEY;
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it('rejects non-POST methods', async () => {
    expect((await handleQuestions({ ...validRequest, method: 'GET' })).status).toBe(405);
  });

  it('rejects non-JSON content types', async () => {
    expect((await handleQuestions({ ...validRequest, contentType: 'text/plain' })).status).toBe(415);
  });

  it('rejects a foreign Origin and accepts same-origin or no Origin', async () => {
    const { ai } = fakeAi([validOutput]);
    const foreign = await handleQuestions({ ...validRequest, origin: 'https://evil.example' }, { ai });
    expect(foreign.status).toBe(403);
    expect((await handleQuestions(validRequest, { ai })).status).toBe(200);
    expect((await handleQuestions({ ...validRequest, origin: null }, { ai })).status).toBe(200);
  });

  it('rejects invalid JSON', async () => {
    expect((await handleQuestions({ ...validRequest, body: '{oops' })).status).toBe(400);
  });

  it('rejects oversized bodies', async () => {
    const result = await handleQuestions(withBody({ topic: 'x'.repeat(MAX_BODY_BYTES) }));
    expect(result.status).toBe(413);
  });

  it.each([
    ['unknown age group', { ageGroup: '13-15', topic: 'חלל', requestId: 'r' }],
    ['missing topic', { ageGroup: '6-8', requestId: 'r' }],
    ['missing requestId', { ageGroup: '6-8', topic: 'חלל' }],
    ['extra previous questions', { ageGroup: '6-8', topic: 'חלל', requestId: 'r', previousQuestions: Array(21).fill('q') }],
  ])('rejects %s with 400', async (_label, body) => {
    const result = await handleQuestions(withBody(body));
    expect(result.status).toBe(400);
    expect(errorCode(result.json)).toBe('invalid_request');
  });

  it('accepts up to 20 previous questions and passes them to the pipeline', async () => {
    const { ai, calls } = fakeAi([validOutput]);
    const previousQuestions = Array.from({ length: 20 }, (_, i) => `שאלה מספר ${i + 1}`);
    const result = await handleQuestions(
      withBody({ ageGroup: '9-12', topic: 'חלל', requestId: 'r', previousQuestions }),
      { ai },
    );
    expect(result.status).toBe(200);
    expect(calls.previousQuestions[0]).toEqual(previousQuestions);
  });

  it('asks for a topic when it is blank, and to shorten it when too long', async () => {
    const { ai } = fakeAi([validOutput]);
    const blank = await handleQuestions(withBody({ ageGroup: '6-8', topic: '   ', requestId: 'r' }), { ai });
    expect(blank.status).toBe(400);
    expect(errorCode(blank.json)).toBe('empty_topic');
    const long = await handleQuestions(withBody({ ageGroup: '6-8', topic: 'א'.repeat(121), requestId: 'r' }), { ai });
    expect(errorCode(long.json)).toBe('topic_too_long');
  });

  it('reports a missing key without leaking anything', async () => {
    delete process.env.OPENAI_API_KEY;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await handleQuestions(validRequest);
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

  it('returns a question with four options, the solution and the request id', async () => {
    const { ai } = fakeAi([validOutput]);
    const result = await handleQuestions(validRequest, { ai });
    expect(result.status).toBe(200);
    const json = result.json as {
      requestId: string;
      prompt: string;
      options: { id: string; text: string }[];
      correctOptionId: string;
      explanation: string;
    };
    expect(json.requestId).toBe('req-1');
    expect(json.prompt).toBe(validOutput.question);
    expect(json.options).toHaveLength(4);
    expect(json.options.find((option) => option.id === json.correctOptionId)?.text).toBe('צדק');
    expect(json.explanation).toBe(validOutput.explanation);
  });

  it('returns a friendly 503 and no question content when no valid candidate is produced', async () => {
    const { ai } = fakeAi([threeOptions, threeOptions]);
    const result = await handleQuestions(validRequest, { ai });
    expect(result.status).toBe(503);
    expect(result.json).toEqual({
      error: {
        code: 'no_valid_question',
        message: 'לא הצלחנו להכין שאלה כרגע. נסו שוב או בחרו נושא אחר.',
        retryable: true,
        requestId: 'req-1',
      },
    });
  });

  it('returns 422 for an unsuitable topic', async () => {
    const { ai } = fakeAi([validOutput], { input: true });
    const result = await handleQuestions(validRequest, { ai });
    expect(result.status).toBe(422);
    expect((result.json as { error: { message: string } }).error.message).toBe(
      'בואו נבחר נושא אחר וננסה שוב.',
    );
  });

  it('ends a hanging provider call with a timeout error', async () => {
    const { ai } = fakeAi(['hang']);
    const result = await handleQuestions(validRequest, { ai, deadlineMs: 100 });
    expect(result.status).toBe(503);
    expect(errorCode(result.json)).toBe('timeout');
  });

  it('never echoes the key or the content in responses or logs', async () => {
    const logs: unknown[] = [];
    for (const level of ['log', 'info', 'warn', 'error'] as const) {
      vi.spyOn(console, level).mockImplementation((...args) => logs.push(...args));
    }
    const { ai } = fakeAi([validOutput]);
    const result = await handleQuestions(validRequest, { ai });
    expect(JSON.stringify(result)).not.toContain(FAKE_KEY);
    const logText = JSON.stringify(logs);
    expect(logText).not.toContain(FAKE_KEY);
    expect(logText).not.toContain('חלל');
    expect(logText).not.toContain('צדק');
    expect(logText).toMatch(/\[questions\] code=ok ms=\d+ attempts=1 tokens=100/);
  });

  it('always sends no-store', async () => {
    const { ai } = fakeAi([validOutput]);
    expect((await handleQuestions(validRequest, { ai })).headers['Cache-Control']).toBe('no-store');
    expect((await handleQuestions({ ...validRequest, method: 'GET' })).headers['Cache-Control']).toBe(
      'no-store',
    );
  });
});
