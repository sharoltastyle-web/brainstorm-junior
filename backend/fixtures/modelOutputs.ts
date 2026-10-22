import type { ModelOutput } from '../questionSchema.ts';

// Synthetic model outputs for tests only. Not a question bank for the product.
export const validOutput: ModelOutput = {
  status: 'ok',
  question: 'מהו כוכב הלכת הגדול ביותר במערכת השמש?',
  options: ['צדק', 'מאדים', 'כדור הארץ', 'נוגה'],
  correctIndex: 0,
  explanation: 'צדק גדול מכדור הארץ פי 11 בקוטר.',
};

export const missingExplanation: ModelOutput = { ...validOutput, explanation: '' };
export const threeOptions: ModelOutput = { ...validOutput, options: ['צדק', 'מאדים', 'נוגה'] };
export const correctIndexOutOfRange: ModelOutput = { ...validOutput, correctIndex: 4 };
export const duplicateOptions: ModelOutput = {
  ...validOutput,
  options: ['צדק', 'מאדים', ' צדק ', 'נוגה'],
};
export const emptyQuestion: ModelOutput = { ...validOutput, question: '' };
export const unsuitableTopic: ModelOutput = {
  status: 'unsuitable_topic',
  question: '',
  options: [],
  correctIndex: 0,
  explanation: '',
};
export const unclearTopic: ModelOutput = { ...unsuitableTopic, status: 'unclear_topic' };
