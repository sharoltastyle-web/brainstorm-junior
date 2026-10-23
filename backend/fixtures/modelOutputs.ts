import type { ModelOutput } from '../questionSchema.js';

// Synthetic model outputs for tests only. Not a question bank for the product.
export const validOutput: ModelOutput = {
  status: 'ok',
  question: 'מהו כוכב הלכת הגדול ביותר במערכת השמש?',
  options: ['צדק', 'מאדים', 'כדור הארץ', 'נוגה'],
  correctIndex: 0,
  explanation: 'צדק גדול מכדור הארץ פי 11 בקוטר.',
};

export const otherValidOutput: ModelOutput = {
  status: 'ok',
  question: 'איזה כוכב לכת מכונה "הכוכב האדום"?',
  options: ['מאדים', 'צדק', 'שבתאי', 'חמה'],
  correctIndex: 0,
  explanation: 'מאדים נראה אדום בגלל חלודה שיש באדמה שלו.',
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
