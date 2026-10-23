import { z } from 'zod';
import { MAX_PREVIOUS_QUESTIONS } from './config.js';

export const AGE_GROUPS = ['6-8', '9-12'] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

// Topic length is checked after normalization in the pipeline, so here it is only bounded loosely.
export const questionRequestSchema = z.object({
  ageGroup: z.enum(AGE_GROUPS),
  topic: z.string().max(1000),
  requestId: z.string().min(1).max(100),
  // Recent questions already shown on this topic: a hint for the model and a duplicate check.
  previousQuestions: z.array(z.string().max(500)).max(MAX_PREVIOUS_QUESTIONS).optional(),
});
export type QuestionRequest = z.infer<typeof questionRequestSchema>;

// Collapses whitespace and Unicode forms so near-identical strings compare equal.
export function normalizeText(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}

// Duplicate detection key: also drops niqqud, punctuation, symbols and letter case.
// Must stay identical to src/game/seen.ts (the frontend cannot import backend modules).
export function normalizeForCompare(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\p{M}/gu, '')
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Raw model output as enforced by Structured Outputs (strict JSON Schema below).
export const modelOutputSchema = z.object({
  status: z.enum(['ok', 'unsuitable_topic', 'unclear_topic']),
  question: z.string(),
  options: z.array(z.string()),
  correctIndex: z.number().int(),
  explanation: z.string(),
});
export type ModelOutput = z.infer<typeof modelOutputSchema>;

// Stricter checks for an "ok" candidate before it may be shown to a child.
export const validQuestionSchema = z
  .object({
    status: z.literal('ok'),
    question: z.string().trim().min(5).max(300),
    options: z.array(z.string().trim().min(1).max(120)).length(4),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string().trim().min(5).max(500),
  })
  .refine(
    (value) => new Set(value.options.map((option) => normalizeText(option).toLowerCase())).size === 4,
    { message: 'options must be distinct' },
  );
export type ValidQuestion = z.infer<typeof validQuestionSchema>;

export const MODEL_OUTPUT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'question', 'options', 'correctIndex', 'explanation'],
  properties: {
    status: { type: 'string', enum: ['ok', 'unsuitable_topic', 'unclear_topic'] },
    question: { type: 'string' },
    options: { type: 'array', items: { type: 'string' } },
    correctIndex: { type: 'integer' },
    explanation: { type: 'string' },
  },
} as const;

export interface QuestionOption {
  id: string;
  text: string;
}

export interface QuestionResponse {
  requestId: string;
  questionId: string;
  prompt: string;
  options: QuestionOption[];
  correctOptionId: string;
  explanation: string;
}
