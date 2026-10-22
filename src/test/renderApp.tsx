import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { App } from '../App';
import { GameProvider, useGame } from '../state/GameContext';

// Exposes current path and age group so tests can assert on in-memory state.
function Probe() {
  const location = useLocation();
  const { ageGroup } = useGame();
  return (
    <output aria-hidden="true" data-testid="probe" data-path={location.pathname} data-age={ageGroup ?? ''} />
  );
}

export function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <GameProvider>
        <App />
        <Probe />
      </GameProvider>
    </MemoryRouter>,
  );
}
