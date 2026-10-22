import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './test/renderApp';

const probe = () => screen.getByTestId('probe');

describe('starting a game', () => {
  it('does not start without an age group and explains why', async () => {
    renderApp('/');
    await userEvent.click(screen.getByRole('button', { name: 'מתחילים לשחק' }));
    expect(screen.getByRole('alert')).toHaveTextContent('צריך לבחור קבוצת גיל');
    expect(probe()).toHaveAttribute('data-path', '/');
    expect(probe()).toHaveAttribute('data-age', '');
  });

  it.each([
    ['6–8', '6-8'],
    ['9–12', '9-12'],
  ])('choosing %s opens trivia with that age group', async (label, value) => {
    renderApp('/');
    await userEvent.click(screen.getByRole('radio', { name: label }));
    await userEvent.click(screen.getByRole('button', { name: 'מתחילים לשחק' }));
    expect(screen.getByRole('heading', { name: 'שאלות טריוויה' })).toBeInTheDocument();
    expect(probe()).toHaveAttribute('data-path', '/trivia');
    expect(probe()).toHaveAttribute('data-age', value);
  });

  it('redirects to home when opening trivia without an age group', () => {
    renderApp('/trivia');
    expect(probe()).toHaveAttribute('data-path', '/');
    expect(screen.getByRole('button', { name: 'מתחילים לשחק' })).toBeInTheDocument();
  });

  it('keeps the age group and topic after visiting about and coming back', async () => {
    renderApp('/');
    await userEvent.click(screen.getByRole('radio', { name: '9–12' }));
    await userEvent.click(screen.getByRole('button', { name: 'מתחילים לשחק' }));
    await userEvent.type(screen.getByLabelText('על איזה נושא נשחק?'), 'חלל');

    await userEvent.click(screen.getByRole('link', { name: 'אודות' }));
    expect(screen.getByRole('heading', { name: 'איך משחקים?' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'טריוויה' }));
    expect(probe()).toHaveAttribute('data-age', '9-12');
    expect(screen.getByLabelText('על איזה נושא נשחק?')).toHaveValue('חלל');

    await userEvent.click(screen.getByRole('link', { name: 'בית' }));
    expect(screen.getByRole('radio', { name: '9–12' })).toBeChecked();
  });

  it('resets state on a fresh load (refresh)', async () => {
    const first = renderApp('/');
    await userEvent.click(screen.getByRole('radio', { name: '6–8' }));
    await userEvent.click(screen.getByRole('button', { name: 'מתחילים לשחק' }));
    first.unmount();

    renderApp('/trivia');
    expect(probe()).toHaveAttribute('data-path', '/');
    expect(probe()).toHaveAttribute('data-age', '');
  });

  it('does not use browser storage for game state', async () => {
    localStorage.clear();
    sessionStorage.clear();
    renderApp('/');
    await userEvent.click(screen.getByRole('radio', { name: '6–8' }));
    await userEvent.click(screen.getByRole('button', { name: 'מתחילים לשחק' }));
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).toBe('');
  });
});

describe('navigation', () => {
  it('shows exactly three items in RTL order with the active one marked', () => {
    renderApp('/about');
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['בית', 'טריוויה', 'אודות']);
    expect(screen.getByRole('link', { name: 'אודות' })).toHaveAttribute('aria-current', 'page');
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });
});

describe('trivia topic', () => {
  it('asks for a topic when it is empty and does not call the server', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderApp('/');
    await userEvent.click(screen.getByRole('radio', { name: '6–8' }));
    await userEvent.click(screen.getByRole('button', { name: 'מתחילים לשחק' }));
    await userEvent.type(screen.getByLabelText('על איזה נושא נשחק?'), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'תנו לי שאלה' }));
    expect(screen.getByRole('alert')).toHaveTextContent('צריך להקליד נושא');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('sends the age group and topic to the server and shows its message', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'not_available_yet', message: 'יצירת שאלות תהיה זמינה בקרוב.' } }),
        { status: 503, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    renderApp('/');
    await userEvent.click(screen.getByRole('radio', { name: '9–12' }));
    await userEvent.click(screen.getByRole('button', { name: 'מתחילים לשחק' }));
    await userEvent.type(screen.getByLabelText('על איזה נושא נשחק?'), ' חלל ');
    await userEvent.click(screen.getByRole('button', { name: 'תנו לי שאלה' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('יצירת שאלות תהיה זמינה בקרוב.');
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/v1/questions');
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({ ageGroup: '9-12', topic: 'חלל' });
    fetchSpy.mockRestore();
  });
});
