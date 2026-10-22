import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { fetchQuestion, type Question } from '../api/questionsApi';

export type AgeGroup = '6-8' | '9-12';
export type GameStatus = 'idle' | 'loading' | 'awaiting_answer' | 'answered' | 'error';

interface GameState {
  ageGroup: AgeGroup | null;
  setAgeGroup: (ageGroup: AgeGroup) => void;
  topic: string;
  setTopic: (topic: string) => void;
  status: GameStatus;
  question: Question | null;
  selectedOptionId: string | null;
  message: string | null;
  requestQuestion: () => Promise<void>;
  selectAnswer: (optionId: string) => void;
}

const GameContext = createContext<GameState | null>(null);

// Game state lives in memory above the screens only: navigation keeps it, a refresh resets it.
export function GameProvider({ children }: { children: ReactNode }) {
  const [ageGroup, setAgeGroup] = useState<AgeGroup | null>(null);
  const [topic, setTopic] = useState('');
  const [status, setStatus] = useState<GameStatus>('idle');
  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Synchronous guard against double clicks before React re-renders the disabled button.
  const loadingRef = useRef(false);
  // Bumped when the age group changes, so a response for the old age group is ignored.
  const ageEpochRef = useRef(0);

  const clearQuestion = useCallback(() => {
    setStatus('idle');
    setQuestion(null);
    setSelectedOptionId(null);
    setMessage(null);
  }, []);

  // Changing the age group cancels the active question (ARCHITECTURE.md §3) and starts from an empty topic.
  const changeAgeGroup = useCallback(
    (next: AgeGroup) => {
      if (next === ageGroup) return;
      ageEpochRef.current++;
      loadingRef.current = false;
      clearQuestion();
      setTopic('');
      setAgeGroup(next);
    },
    [ageGroup, clearQuestion],
  );

  const requestQuestion = useCallback(async () => {
    // A shown question must be answered first, so a stray click or Enter cannot replace it.
    if (loadingRef.current || !ageGroup || status === 'awaiting_answer') return;
    const trimmed = topic.trim();
    if (!trimmed) {
      setMessage('צריך להקליד נושא כדי לקבל שאלה.');
      return;
    }
    const epoch = ageEpochRef.current;
    loadingRef.current = true;
    setStatus('loading');
    setQuestion(null);
    setSelectedOptionId(null);
    setMessage(null);
    const result = await fetchQuestion(ageGroup, trimmed);
    if (epoch !== ageEpochRef.current) return;
    loadingRef.current = false;
    if (result.ok) {
      setQuestion(result.question);
      setStatus('awaiting_answer');
    } else {
      setMessage(result.message);
      setStatus('error');
    }
  }, [ageGroup, topic, status]);

  // The first choice locks the question; the check runs locally without network.
  const selectAnswer = useCallback(
    (optionId: string) => {
      if (status !== 'awaiting_answer' || selectedOptionId) return;
      setSelectedOptionId(optionId);
      setStatus('answered');
      setMessage(null);
    },
    [status, selectedOptionId],
  );

  const value = useMemo(
    () => ({
      ageGroup,
      setAgeGroup: changeAgeGroup,
      topic,
      setTopic,
      status,
      question,
      selectedOptionId,
      message,
      requestQuestion,
      selectAnswer,
    }),
    [ageGroup, changeAgeGroup, topic, status, question, selectedOptionId, message, requestQuestion, selectAnswer],
  );
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameState {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used inside GameProvider');
  return context;
}
