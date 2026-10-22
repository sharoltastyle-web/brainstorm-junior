// @vitest-environment node
import OpenAI from 'openai';
import {
  correctIndexOutOfRange,
  duplicateOptions,
  emptyQuestion,
  missingExplanation,
  threeOptions,
  unclearTopic,
  unsuitableTopic,
  validOutput,
} from './fixtures/modelOutputs.ts';
import { AiError, toAiError } from './openaiClient.ts';
import { fakeAi } from './testing/fakeAi.ts';
import { generateTriviaQuestion, shuffleQuestion } from './triviaService.ts';
import { validQuestionSchema } from './questionSchema.ts';

describe('generateTriviaQuestion', () => {
  it('returns a valid, shuffled question whose correct id points at the right answer', async () => {
    const { ai, calls } = fakeAi([validOutput]);
    const result = await generateTriviaQuestion(ai, '6-8', '  חלל  ');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { question } = result;
    expect(question.options).toHaveLength(4);
    expect(question.options.map((option) => option.id)).toEqual(['a', 'b', 'c', 'd']);
    const correct = question.options.find((option) => option.id === question.correctOptionId);
    expect(correct?.text).toBe('צדק');
    expect(question.explanation).toBe(validOutput.explanation);
    expect(calls.generate).toBe(1);
    // Input moderation, then output moderation of question + 4 options + explanation.
    expect(calls.moderatedTexts[0]).toEqual(['חלל']);
    expect(calls.moderatedTexts[1]).toHaveLength(6);
  });

  it.each([
    ['missing explanation', missingExplanation],
    ['three options', threeOptions],
    ['correct index out of range', correctIndexOutOfRange],
    ['duplicate options (whitespace differences)', duplicateOptions],
    ['empty question', emptyQuestion],
    ['refusal / unparseable output', null],
  ])('rejects %s and retries once, then gives up without content', async (_label, bad) => {
    const { ai, calls } = fakeAi([bad, bad]);
    const result = await generateTriviaQuestion(ai, '9-12', 'חלל');
    expect(result).toMatchObject({ ok: false, code: 'no_valid_question', attempts: 2 });
    expect(calls.generate).toBe(2);
  });

  it('uses the single fallback attempt when the first candidate is invalid', async () => {
    const { ai, calls } = fakeAi([threeOptions, validOutput]);
    const result = await generateTriviaQuestion(ai, '9-12', 'חלל');
    expect(result.ok).toBe(true);
    expect(calls.generate).toBe(2);
  });

  it('drops output flagged by moderation and never makes more than two generation calls', async () => {
    const { ai, calls } = fakeAi([validOutput], { output: [true, true] });
    const result = await generateTriviaQuestion(ai, '6-8', 'חלל');
    expect(result).toMatchObject({ ok: false, code: 'no_valid_question' });
    expect(calls.generate).toBe(2);
  });

  it('stops before generation when the topic is flagged by input moderation', async () => {
    const { ai, calls } = fakeAi([validOutput], { input: true });
    const result = await generateTriviaQuestion(ai, '6-8', 'משהו לא מתאים');
    expect(result).toMatchObject({ ok: false, code: 'unsuitable_topic' });
    expect(calls.generate).toBe(0);
  });

  it.each([
    ['unsuitable_topic', unsuitableTopic],
    ['unclear_topic', unclearTopic],
  ])('returns %s from the model without a fallback attempt', async (code, output) => {
    const { ai, calls } = fakeAi([output]);
    const result = await generateTriviaQuestion(ai, '6-8', 'אבגדה');
    expect(result).toMatchObject({ ok: false, code });
    expect(calls.generate).toBe(1);
  });

  it('rejects empty and too long topics without calling the AI', async () => {
    const { ai, calls } = fakeAi([validOutput]);
    expect(await generateTriviaQuestion(ai, '6-8', '   ')).toMatchObject({ code: 'empty_topic' });
    expect(await generateTriviaQuestion(ai, '6-8', 'א'.repeat(121))).toMatchObject({
      code: 'topic_too_long',
    });
    expect(calls.moderate).toBe(0);
  });

  it('ends with a timeout when the model does not answer before the deadline', async () => {
    const { ai } = fakeAi(['hang']);
    const started = Date.now();
    const result = await generateTriviaQuestion(ai, '6-8', 'חלל', { deadlineMs: 200, callTimeoutMs: 100 });
    expect(result).toMatchObject({ ok: false, code: 'timeout' });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it.each([
    ['rate_limited', new AiError('rate_limited')],
    ['budget_exhausted', new AiError('budget_exhausted')],
    ['provider_error', new Error('boom')],
  ])('maps provider failures to %s', async (code, error) => {
    const { ai } = fakeAi([error]);
    expect(await generateTriviaQuestion(ai, '6-8', 'חלל')).toMatchObject({ ok: false, code });
  });
});

describe('toAiError', () => {
  const headers = new Headers();
  it('separates budget exhaustion from rate limiting', () => {
    const quota = new OpenAI.RateLimitError(429, { code: 'insufficient_quota' }, 'quota', headers);
    const rate = new OpenAI.RateLimitError(429, { code: 'rate_limit_exceeded' }, 'rate', headers);
    expect(toAiError(quota).kind).toBe('budget_exhausted');
    expect(toAiError(rate).kind).toBe('rate_limited');
  });

  it('treats aborts and timeouts as timeout', () => {
    expect(toAiError(new OpenAI.APIUserAbortError()).kind).toBe('timeout');
    expect(toAiError(new DOMException('t', 'TimeoutError')).kind).toBe('timeout');
  });
});

describe('shuffleQuestion', () => {
  it('keeps the correct answer under every permutation', () => {
    const candidate = validQuestionSchema.parse(validOutput);
    for (let seed = 0; seed < 20; seed++) {
      let state = seed / 20;
      const random = () => (state = (state * 9301 + 0.49297) % 1);
      const { options, correctOptionId } = shuffleQuestion(candidate, random);
      expect(options.find((option) => option.id === correctOptionId)?.text).toBe('צדק');
      expect(new Set(options.map((option) => option.text)).size).toBe(4);
    }
  });
});
