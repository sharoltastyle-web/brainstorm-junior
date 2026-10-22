import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type AgeGroup = '6-8' | '9-12';

interface GameState {
  ageGroup: AgeGroup | null;
  setAgeGroup: (ageGroup: AgeGroup) => void;
  topic: string;
  setTopic: (topic: string) => void;
}

const GameContext = createContext<GameState | null>(null);

// Game state lives in memory above the screens only: navigation keeps it, a refresh resets it.
export function GameProvider({ children }: { children: ReactNode }) {
  const [ageGroup, setAgeGroup] = useState<AgeGroup | null>(null);
  const [topic, setTopic] = useState('');
  const value = useMemo(() => ({ ageGroup, setAgeGroup, topic, setTopic }), [ageGroup, topic]);
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameState {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used inside GameProvider');
  return context;
}
