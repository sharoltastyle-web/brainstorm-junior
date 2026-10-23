import type { AiClient, GenerationResult } from '../openaiClient.js';
import type { ModelOutput } from '../questionSchema.js';

export type GenerateStep = ModelOutput | null | Error | 'hang';

// Fake AI client: replays scripted generation results and moderation verdicts.
export function fakeAi(
  steps: GenerateStep[],
  moderation: { input?: boolean; output?: boolean[] } = {},
) {
  const calls = {
    generate: 0,
    moderate: 0,
    moderatedTexts: [] as string[][],
    previousQuestions: [] as string[][],
  };
  let outputModerations = 0;
  const ai: AiClient = {
    generate(_ageGroup, _topic, previousQuestions, signal) {
      const step = steps[Math.min(calls.generate, steps.length - 1)];
      calls.generate++;
      calls.previousQuestions.push(previousQuestions);
      if (step === 'hang') {
        return new Promise<GenerationResult>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason));
        });
      }
      if (step instanceof Error) return Promise.reject(step);
      return Promise.resolve({ output: step, tokens: 100 });
    },
    moderate(texts) {
      calls.moderate++;
      calls.moderatedTexts.push(texts);
      if (calls.moderate === 1) return Promise.resolve(moderation.input ?? false);
      return Promise.resolve(moderation.output?.[outputModerations++] ?? false);
    },
  };
  return { ai, calls };
}
