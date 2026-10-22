import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CLIENT_TIMEOUT_MS } from '../api/questionsApi';
import { renderApp } from '../test/renderApp';

const QUESTION = {
  requestId: 'r',
  questionId: 'q1',
  prompt: 'מהו כוכב הלכת הגדול ביותר במערכת השמש?',
  options: [
    { id: 'a', text: 'כדור הארץ' },
    { id: 'b', text: 'מאדים' },
    { id: 'c', text: 'צדק' },
    { id: 'd', text: 'נוגה' },
  ],
  correctOptionId: 'c',
  explanation: 'צדק גדול מכדור הארץ פי 11 בקוטר.',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function startTrivia(age: '6–8' | '9–12' = '9–12') {
  renderApp('/');
  await userEvent.click(screen.getByRole('radio', { name: age }));
  await userEvent.click(screen.getByRole('button', { name: 'מתחילים לשחק' }));
  await userEvent.type(screen.getByLabelText('על איזה נושא נשחק?'), ' חלל ');
}

const askButton = () => screen.getByRole('button', { name: 'תנו לי שאלה' });
const answers = () => within(screen.getByRole('group')).getAllByRole('radio');

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('asking for a question', () => {
  it('sends age group and trimmed topic, shows loading and disables the button', async () => {
    let resolve!: (response: Response) => void;
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    await startTrivia('9–12');
    await userEvent.click(askButton());

    expect(screen.getByRole('status')).toHaveTextContent('מכינים לך שאלה...');
    expect(askButton()).toBeDisabled();
    await userEvent.click(askButton());
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/v1/questions');
    expect(JSON.parse(String(init?.body))).toMatchObject({ ageGroup: '9-12', topic: 'חלל' });

    await act(async () => resolve(jsonResponse(QUESTION)));
    expect(await screen.findByRole('heading', { name: QUESTION.prompt })).toBeInTheDocument();
  });

  it('shows four answers without revealing the solution or explanation', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(QUESTION));
    await startTrivia();
    await userEvent.click(askButton());
    await screen.findByRole('heading', { name: QUESTION.prompt });

    expect(answers()).toHaveLength(4);
    expect(answers().every((radio) => !(radio as HTMLInputElement).checked)).toBe(true);
    expect(document.body).not.toHaveTextContent(QUESTION.explanation);
    expect(document.body).not.toHaveTextContent('התשובה הנכונה היא');
    expect(document.body).not.toHaveTextContent('כל הכבוד');
  });
});

describe('answering', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(QUESTION));
  });

  async function showQuestion() {
    await startTrivia();
    await userEvent.click(askButton());
    await screen.findByRole('heading', { name: QUESTION.prompt });
  }

  it('a correct answer shows success and the explanation', async () => {
    await showQuestion();
    await userEvent.click(screen.getByRole('radio', { name: 'צדק' }));
    const feedback = screen.getByRole('status');
    expect(feedback).toHaveTextContent('כל הכבוד! תשובה נכונה!');
    expect(feedback).toHaveTextContent(QUESTION.explanation);
    expect(feedback).not.toHaveTextContent('התשובה הנכונה היא');
  });

  it('a wrong answer shows the correct answer explicitly and the explanation', async () => {
    await showQuestion();
    await userEvent.click(screen.getByRole('radio', { name: 'מאדים' }));
    const feedback = screen.getByRole('status');
    expect(feedback).toHaveTextContent('הפעם לא הצלחת.');
    expect(feedback).toHaveTextContent('התשובה הנכונה היא: צדק');
    expect(feedback).toHaveTextContent(QUESTION.explanation);
  });

  it('locks the first choice; later clicks change nothing', async () => {
    await showQuestion();
    await userEvent.click(screen.getByRole('radio', { name: 'מאדים' }));
    await userEvent.click(screen.getByRole('radio', { name: 'צדק' }));
    expect(screen.getByRole('radio', { name: 'מאדים' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'צדק' })).not.toBeChecked();
    for (const radio of answers()) expect(radio).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('הפעם לא הצלחת.');
  });

  it('blocks a new question until the shown one is answered', async () => {
    await showQuestion();
    expect(askButton()).toBeDisabled();
    await userEvent.type(screen.getByLabelText('על איזה נושא נשחק?'), '{Enter}');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: QUESTION.prompt })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'צדק' }));
    expect(askButton()).toBeEnabled();
    await userEvent.click(askButton());
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('answering needs no network call', async () => {
    await showQuestion();
    const calls = vi.mocked(fetch).mock.calls.length;
    await userEvent.click(screen.getByRole('radio', { name: 'צדק' }));
    expect(vi.mocked(fetch).mock.calls.length).toBe(calls);
  });

  it('keeps the question and feedback after visiting about and coming back', async () => {
    await showQuestion();
    await userEvent.click(screen.getByRole('radio', { name: 'מאדים' }));
    await userEvent.click(screen.getByRole('link', { name: 'אודות' }));
    await userEvent.click(screen.getByRole('link', { name: 'טריוויה' }));
    expect(screen.getByRole('heading', { name: QUESTION.prompt })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'מאדים' })).toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('התשובה הנכונה היא: צדק');
  });
});

describe('changing the age group', () => {
  async function switchAge(age: '6–8' | '9–12') {
    await userEvent.click(screen.getByRole('link', { name: 'בית' }));
    await userEvent.click(screen.getByRole('radio', { name: age }));
    await userEvent.click(screen.getByRole('button', { name: 'מתחילים לשחק' }));
  }

  it('clears the answered question for a fresh trivia screen', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(QUESTION));
    await startTrivia('6–8');
    await userEvent.click(askButton());
    await screen.findByRole('heading', { name: QUESTION.prompt });
    await userEvent.click(screen.getByRole('radio', { name: 'מאדים' }));

    await switchAge('9–12');
    expect(screen.queryByRole('heading', { name: QUESTION.prompt })).toBeNull();
    expect(screen.queryByRole('group')).toBeNull();
    expect(document.body).not.toHaveTextContent('הפעם לא הצלחת');
    expect(screen.getByLabelText('על איזה נושא נשחק?')).toHaveValue('');
  });

  it('keeps the question when the same age group is chosen again', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(QUESTION));
    await startTrivia('6–8');
    await userEvent.click(askButton());
    await screen.findByRole('heading', { name: QUESTION.prompt });

    await switchAge('6–8');
    expect(screen.getByRole('heading', { name: QUESTION.prompt })).toBeInTheDocument();
    expect(screen.getByLabelText('על איזה נושא נשחק?')).toHaveValue(' חלל ');
  });

  it('ignores a late response requested for the previous age group', async () => {
    let resolve!: (response: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise<Response>((r) => (resolve = r)));
    await startTrivia('6–8');
    await userEvent.click(askButton());

    await switchAge('9–12');
    await act(async () => resolve(jsonResponse(QUESTION)));
    expect(screen.queryByRole('heading', { name: QUESTION.prompt })).toBeNull();
    expect(askButton()).toBeEnabled();
  });
});

describe('failures', () => {
  it('shows the server message and no question', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ error: { code: 'unsuitable_topic', message: 'בואו נבחר נושא אחר וננסה שוב.' } }, 422),
    );
    await startTrivia();
    await userEvent.click(askButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('בואו נבחר נושא אחר וננסה שוב.');
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.queryByText('מכינים לך שאלה...')).toBeNull();
    expect(askButton()).toBeEnabled();
  });

  it('does not show a malformed question', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ ...QUESTION, options: QUESTION.options.slice(0, 3) }),
    );
    await startTrivia();
    await userEvent.click(askButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('משהו השתבש. נסו שוב.');
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('shows a message on a network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await startTrivia();
    await userEvent.click(askButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('משהו השתבש. נסו שוב.');
  });

  it('ends loading with a message when the server never answers', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    await startTrivia();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    act(() => askButton().click());
    expect(screen.getByRole('status')).toHaveTextContent('מכינים לך שאלה...');
    await act(async () => {
      vi.advanceTimersByTime(CLIENT_TIMEOUT_MS + 10);
    });
    vi.useRealTimers();
    expect(await screen.findByRole('alert')).toHaveTextContent('משהו השתבש. נסו שוב.');
    expect(screen.queryByText('מכינים לך שאלה...')).toBeNull();
  });
});
