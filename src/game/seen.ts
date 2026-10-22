// Questions shown during the current game, kept in memory only (no browser storage).
// Keyed by normalized topic, so switching topics and coming back keeps the history.
export type SeenQuestions = Map<string, string[]>;

export const MAX_PREVIOUS_QUESTIONS = 20;

// Duplicate detection key: drops niqqud, punctuation, symbols, extra spaces and letter case.
// Must stay identical to normalizeForCompare in backend/questionSchema.ts.
export function normalizeForCompare(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\p{M}/gu, '')
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function topicKey(topic: string): string {
  return normalizeForCompare(topic);
}

// The latest questions on a topic, sent to the server as a hint. The full list stays in the browser.
export function recentForTopic(seen: SeenQuestions, topic: string, limit = MAX_PREVIOUS_QUESTIONS): string[] {
  return (seen.get(topicKey(topic)) ?? []).slice(-limit);
}

// Checked against every question shown on the topic, not only the ones sent to the server.
export function isSeen(seen: SeenQuestions, topic: string, prompt: string): boolean {
  const key = normalizeForCompare(prompt);
  return (seen.get(topicKey(topic)) ?? []).some((shown) => normalizeForCompare(shown) === key);
}

export function markSeen(seen: SeenQuestions, topic: string, prompt: string): void {
  const key = topicKey(topic);
  seen.set(key, [...(seen.get(key) ?? []), prompt]);
}
