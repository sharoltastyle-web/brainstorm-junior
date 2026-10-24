import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/renderApp';

// M3: continuing the game, switching topics, no repeats, no stale responses, offline.

const makeQuestion = (n: number, prompt = `שאלה מספר ${n} על הנושא?`) => ({
  requestId: 'r',
  questionId: `q${n}`,
  prompt,
  options: [
    { id: 'a', text: `תשובה א${n}` },
    { id: 'b', text: `תשובה ב${n}` },
    { id: 'c', text: `תשובה ג${n}` },
    { id: 'd', text: `תשובה ד${n}` },
  ],
  correctOptionId: 'a',
  explanation: `הסבר לשאלה ${n}.`,
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Replies with the given questions in order and records every request body.
function mockQuestions(...replies: unknown[]) {
  const bodies: { ageGroup: string; topic: string; requestId: string; previousQuestions: string[] }[] = [];
  let index = 0;
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    const reply = replies[Math.min(index++, replies.length - 1)];
    return reply instanceof Response ? reply : jsonResponse(reply);
  });
  return { bodies, spy };
}

const topicInput = () => screen.getByLabelText('על איזה נושא נשחק?');
const askButton = () => screen.getByRole('button', { name: 'תנו לי שאלה' });
const moreButton = () => screen.getByRole('button', { name: 'עוד שאלה באותו נושא' });

async function startTrivia(age: '6–8' | '9–12' = '9–12') {
  const view = renderApp('/');
  await userEvent.click(screen.getByRole('radio', { name: age }));
  await userEvent.click(screen.getByRole('button', { name: 'מתחילים לשחק' }));
  return view;
}

async function askTopic(topic: string) {
  await userEvent.clear(topicInput());
  await userEvent.type(topicInput(), topic);
  await userEvent.click(askButton());
}

async function answerFirst() {
  await userEvent.click(screen.getByRole('radio', { name: /^תשובה א/ }));
}

async function expectShown(prompt: string) {
  expect(await screen.findByRole('heading', { name: prompt })).toBeInTheDocument();
}

function setOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('more questions on the same topic', () => {
  it('appears only after answering and asks again with the shown questions', async () => {
    const { bodies } = mockQuestions(makeQuestion(1), makeQuestion(2), makeQuestion(3));
    await startTrivia();
    await askTopic('חלל');
    await expectShown(makeQuestion(1).prompt);
    expect(screen.queryByRole('button', { name: 'עוד שאלה באותו נושא' })).toBeNull();

    await answerFirst();
    await userEvent.click(moreButton());
    await expectShown(makeQuestion(2).prompt);
    await answerFirst();
    await userEvent.click(moreButton());
    await expectShown(makeQuestion(3).prompt);

    expect(bodies.map((body) => body.topic)).toEqual(['חלל', 'חלל', 'חלל']);
    expect(bodies[0].previousQuestions).toEqual([]);
    expect(bodies[2].previousQuestions).toEqual([makeQuestion(1).prompt, makeQuestion(2).prompt]);
  });

  it('stays on the question topic even if the field was edited after answering', async () => {
    const { bodies } = mockQuestions(makeQuestion(1), makeQuestion(2));
    await startTrivia();
    await askTopic('חלל');
    await expectShown(makeQuestion(1).prompt);
    await answerFirst();
    await userEvent.type(topicInput(), ' ועוד');
    await userEvent.click(moreButton());
    await expectShown(makeQuestion(2).prompt);
    expect(bodies[1].topic).toBe('חלל');
    expect(topicInput()).toHaveValue('חלל');
  });
});

describe('switching topics and coming back', () => {
  it('remembers questions per topic across a topic switch', async () => {
    const { bodies } = mockQuestions(makeQuestion(1), makeQuestion(2), makeQuestion(3), makeQuestion(4));
    await startTrivia();
    await askTopic('חלל');
    await expectShown(makeQuestion(1).prompt);
    await answerFirst();
    await userEvent.click(moreButton());
    await expectShown(makeQuestion(2).prompt);
    await answerFirst();

    await askTopic('בעלי חיים');
    await expectShown(makeQuestion(3).prompt);
    await answerFirst();

    await askTopic(' חלל. ');
    await expectShown(makeQuestion(4).prompt);
    expect(bodies[2].previousQuestions).toEqual([]);
    expect(bodies[3].previousQuestions).toEqual([makeQuestion(1).prompt, makeQuestion(2).prompt]);
  });

  it('never shows a repeated question, even with punctuation and spacing differences', async () => {
    const first = makeQuestion(1, 'מהו כוכב הלכת הגדול ביותר?');
    const repeat = makeQuestion(9, '  מהו כוכב-הלכת  הגדול ביותר ');
    mockQuestions(first, makeQuestion(2), repeat);
    await startTrivia();
    await askTopic('חלל');
    await expectShown(first.prompt);
    await answerFirst();
    await askTopic('בעלי חיים');
    await expectShown(makeQuestion(2).prompt);
    await answerFirst();

    await askTopic('חלל');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'לא הצלחנו להכין שאלה חדשה כרגע. נסו שוב או בחרו נושא אחר.',
    );
    expect(screen.queryByRole('group')).toBeNull();
    expect(askButton()).toBeEnabled();
  });

  it('checks the full seen list, not only the 20 sent to the server', async () => {
    const replies = Array.from({ length: 21 }, (_, i) => makeQuestion(i + 1));
    const { bodies } = mockQuestions(...replies, makeQuestion(1));
    await startTrivia();
    await askTopic('חלל');
    await expectShown(makeQuestion(1).prompt);
    for (let n = 2; n <= 21; n++) {
      await answerFirst();
      await userEvent.click(moreButton());
      await expectShown(makeQuestion(n).prompt);
    }
    await answerFirst();
    await userEvent.click(moreButton());

    const last = bodies[21].previousQuestions;
    expect(last).toHaveLength(20);
    expect(last).not.toContain(makeQuestion(1).prompt);
    expect(last.at(-1)).toBe(makeQuestion(21).prompt);
    expect(await screen.findByRole('alert')).toHaveTextContent('לא הצלחנו להכין שאלה חדשה כרגע');
    expect(screen.queryByRole('heading', { name: makeQuestion(1).prompt })).toBeNull();
  });

  it('after a server "no valid question" error, allows trying again or another topic', async () => {
    const noValid = jsonResponse(
      {
        error: {
          code: 'no_valid_question',
          message: 'לא הצלחנו להכין שאלה כרגע. נסו שוב או בחרו נושא אחר.',
          retryable: true,
          requestId: 'r',
        },
      },
      503,
    );
    const { bodies } = mockQuestions(makeQuestion(1), noValid, makeQuestion(2));
    await startTrivia();
    await askTopic('חלל');
    await expectShown(makeQuestion(1).prompt);
    await answerFirst();
    await userEvent.click(moreButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('לא הצלחנו להכין שאלה כרגע');
    expect(askButton()).toBeEnabled();
    expect(topicInput()).toHaveValue('חלל');

    await userEvent.click(askButton());
    await expectShown(makeQuestion(2).prompt);
    expect(bodies).toHaveLength(3);
  });
});

describe('double clicks and stale responses', () => {
  it('a fast double click or double Enter sends a single request', async () => {
    let resolve!: (response: Response) => void;
    const spy = vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    await startTrivia();
    await userEvent.type(topicInput(), 'חלל');
    act(() => {
      askButton().click();
      askButton().click();
    });
    await userEvent.type(topicInput(), '{Enter}{Enter}');
    expect(spy).toHaveBeenCalledTimes(1);
    await act(async () => resolve(jsonResponse(makeQuestion(1))));
    await expectShown(makeQuestion(1).prompt);
  });

  it('a late response for an old request does not replace the current one', async () => {
    const resolvers: ((response: Response) => void)[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise<Response>((r) => resolvers.push(r)),
    );
    await startTrivia('6–8');
    await askTopic('חלל');

    // Age change cancels the request; a new one starts on another topic.
    await userEvent.click(screen.getByRole('link', { name: 'בית' }));
    await userEvent.click(screen.getByRole('radio', { name: '9–12' }));
    await userEvent.click(screen.getByRole('button', { name: 'מתחילים לשחק' }));
    await askTopic('בעלי חיים');
    expect(resolvers).toHaveLength(2);

    await act(async () => resolvers[0](jsonResponse(makeQuestion(1))));
    expect(screen.queryByRole('heading', { name: makeQuestion(1).prompt })).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('מכינים לך שאלה...');

    await act(async () => resolvers[1](jsonResponse(makeQuestion(2))));
    await expectShown(makeQuestion(2).prompt);
  });

  it('changing the age group keeps the seen list', async () => {
    const { bodies } = mockQuestions(makeQuestion(1), makeQuestion(1));
    await startTrivia('6–8');
    await askTopic('חלל');
    await expectShown(makeQuestion(1).prompt);
    await answerFirst();

    await userEvent.click(screen.getByRole('link', { name: 'בית' }));
    await userEvent.click(screen.getByRole('radio', { name: '9–12' }));
    await userEvent.click(screen.getByRole('button', { name: 'מתחילים לשחק' }));
    await askTopic('חלל');
    expect(bodies[1]).toMatchObject({ ageGroup: '9-12', previousQuestions: [makeQuestion(1).prompt] });
    expect(await screen.findByRole('alert')).toHaveTextContent('לא הצלחנו להכין שאלה חדשה כרגע');
  });
});

describe('offline', () => {
  it('a shown question can still be answered offline; a new one shows the connection message', async () => {
    const { spy } = mockQuestions(makeQuestion(1));
    await startTrivia();
    await askTopic('חלל');
    await expectShown(makeQuestion(1).prompt);

    setOnline(false);
    await userEvent.click(screen.getByRole('radio', { name: 'תשובה ב1' }));
    expect(screen.getByRole('status')).toHaveTextContent('התשובה הנכונה היא: תשובה א1');
    expect(screen.getByRole('status')).toHaveTextContent('הסבר לשאלה 1.');

    await userEvent.click(moreButton());
    expect(screen.getByRole('alert')).toHaveTextContent('כדי לקבל שאלה, צריך להתחבר לאינטרנט.');
    expect(spy).toHaveBeenCalledTimes(1);
    // The answered question and its feedback stay on screen.
    await expectShown(makeQuestion(1).prompt);
    expect(screen.getByRole('status')).toHaveTextContent('התשובה הנכונה היא: תשובה א1');

    setOnline(true);
    await userEvent.click(askButton());
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('a network failure while offline shows the connection message', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      setOnline(false);
      throw new TypeError('Failed to fetch');
    });
    await startTrivia();
    await askTopic('חלל');
    expect(await screen.findByRole('alert')).toHaveTextContent('כדי לקבל שאלה, צריך להתחבר לאינטרנט.');
  });
});

describe('navigation, refresh and storage', () => {
  it('about and back keeps the game, including the seen list', async () => {
    const { bodies } = mockQuestions(makeQuestion(1), makeQuestion(2));
    await startTrivia();
    await askTopic('חלל');
    await expectShown(makeQuestion(1).prompt);
    await answerFirst();
    await userEvent.click(screen.getByRole('link', { name: 'אודות' }));
    await userEvent.click(screen.getByRole('link', { name: 'טריוויה' }));
    await expectShown(makeQuestion(1).prompt);
    await userEvent.click(moreButton());
    expect(bodies[1].previousQuestions).toEqual([makeQuestion(1).prompt]);
  });

  it('a refresh starts a new game with an empty seen list', async () => {
    const { bodies } = mockQuestions(makeQuestion(1), makeQuestion(1));
    const first = await startTrivia();
    await askTopic('חלל');
    await expectShown(makeQuestion(1).prompt);
    await answerFirst();

    // Simulates a refresh: a fresh app instance.
    first.unmount();
    await startTrivia();
    await askTopic('חלל');
    await expectShown(makeQuestion(1).prompt);
    expect(bodies[1].previousQuestions).toEqual([]);
  });

  it('stores nothing in browser storage or cookies during a game', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    mockQuestions(makeQuestion(1), makeQuestion(2));
    await startTrivia();
    await askTopic('חלל');
    await expectShown(makeQuestion(1).prompt);
    await answerFirst();
    await userEvent.click(moreButton());
    await expectShown(makeQuestion(2).prompt);
    expect(setItem).not.toHaveBeenCalled();
    expect(document.cookie).toBe('');
  });

  it('app code does not use localStorage, sessionStorage, IndexedDB or cookies', () => {
    const sources = import.meta.glob<string>(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}', '!../test/**'], {
      query: '?raw',
      import: 'default',
      eager: true,
    });
    expect(Object.keys(sources).length).toBeGreaterThan(5);
    for (const [file, source] of Object.entries(sources)) {
      expect(source, file).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
    }
  });
});

describe('switching to the next topic', () => {
  it('appears only after answering, clears and focuses the topic field without a new request', async () => {
    const { spy } = mockQuestions(makeQuestion(1), makeQuestion(2));
    await startTrivia();
    await askTopic('חלל');
    await expectShown(makeQuestion(1).prompt);
    expect(screen.queryByRole('button', { name: 'מעבר לנושא הבא' })).toBeNull();

    await answerFirst();
    await userEvent.click(screen.getByRole('button', { name: 'מעבר לנושא הבא' }));
    expect(topicInput()).toHaveValue('');
    expect(topicInput()).toHaveFocus();
    expect(spy).toHaveBeenCalledTimes(1);

    await userEvent.type(topicInput(), 'דינוזאורים');
    await userEvent.click(askButton());
    await expectShown(makeQuestion(2).prompt);
  });
});
