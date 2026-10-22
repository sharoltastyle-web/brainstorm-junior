import { isSeen, markSeen, normalizeForCompare, recentForTopic, type SeenQuestions } from './seen';

describe('normalizeForCompare', () => {
  // Same table as backend/triviaService.test.ts, so both sides agree.
  it.each([
    ['מהו כוכב הלכת הגדול ביותר?', '  מהו כוכב  הלכת הגדול ביותר '],
    ['מהו כוכב הלכת הגדול ביותר?', 'מהו כוכב-הלכת, הגדול ביותר.'],
    ['מה זה "צדק"?', 'מה זה ״צדק״'],
    ['איזו חיה היא ג\'ירפה?', 'איזו חיה היא ג׳ירפה'],
    ['שָׁלוֹם עוֹלָם', 'שלום עולם'],
    ['What is DNA?', 'what is dna'],
  ])('treats "%s" and "%s" as the same question', (a, b) => {
    expect(normalizeForCompare(a)).toBe(normalizeForCompare(b));
  });

  it('keeps different questions different', () => {
    expect(normalizeForCompare('מהו כוכב הלכת הגדול ביותר?')).not.toBe(
      normalizeForCompare('מהו כוכב הלכת הקטן ביותר?'),
    );
  });
});

describe('seen questions', () => {
  it('groups by normalized topic and keeps topics apart', () => {
    const seen: SeenQuestions = new Map();
    markSeen(seen, 'חלל', 'שאלה א?');
    markSeen(seen, ' חלל. ', 'שאלה ב?');
    markSeen(seen, 'בעלי חיים', 'שאלה ג?');
    expect(recentForTopic(seen, 'חלל')).toEqual(['שאלה א?', 'שאלה ב?']);
    expect(isSeen(seen, 'חלל', 'שאלה  א')).toBe(true);
    expect(isSeen(seen, 'חלל', 'שאלה ג?')).toBe(false);
  });

  it('sends only the latest 20 but remembers all of them', () => {
    const seen: SeenQuestions = new Map();
    for (let i = 1; i <= 25; i++) markSeen(seen, 'חלל', `שאלה ${i}`);
    const recent = recentForTopic(seen, 'חלל');
    expect(recent).toHaveLength(20);
    expect(recent[0]).toBe('שאלה 6');
    expect(isSeen(seen, 'חלל', 'שאלה 1')).toBe(true);
  });
});
