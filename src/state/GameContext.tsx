import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { fetchQuestion, isOffline, OFFLINE_ERROR, type Question } from '../api/questionsApi';
import { isSeen, markSeen, recentForTopic, type SeenQuestions } from '../game/seen';

export type AgeGroup = '6-8' | '9-12';
export type GameStatus = 'idle' | 'loading' | 'awaiting_answer' | 'answered' | 'error';

export const DUPLICATE_ERROR = 'לא הצלחנו להכין שאלה חדשה כרגע. נסו שוב או בחרו נושא אחר.';

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
  requestMoreSameTopic: () => Promise<void>;
  selectAnswer: (optionId: string) => void;
}

const GameContext = createContext<GameState | null>(null);

// Game state lives in memory above the screens only: navigation keeps it, a refresh resets it.
export function GameProvider({ children }: { children: ReactNode }) {
  const [ageGroup, setAgeGroup] = useState<AgeGroup | null>(null);
  const [topic, setTopic] = useState('');
  const [status, setStatus] = useState<GameStatus>('idle');
  const [question, setQuestion] = useState<Question | null>(null);
  // The topic the shown question was requested for; "more on the same topic" reuses it.
  const [questionTopic, setQuestionTopic] = useState<string | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Synchronous guard against double clicks before React re-renders the disabled button.
  const loadingRef = useRef(false);
  // Only the response to this request may update the screen; anything older is ignored.
  const activeRequestRef = useRef<string | null>(null);
  // Every question shown in this game, per topic. Survives topic and age changes, not a refresh.
  const seenRef = useRef<SeenQuestions>(new Map());

  const clearQuestion = useCallback(() => {
    setStatus('idle');
    setQuestion(null);
    setQuestionTopic(null);
    setSelectedOptionId(null);
    setMessage(null);
  }, []);

  // Changing the age group cancels the active question (ARCHITECTURE.md §3) and starts from an empty topic.
  // The seen list is kept on purpose.
  const changeAgeGroup = useCallback(
    (next: AgeGroup) => {
      if (next === ageGroup) return;
      activeRequestRef.current = null;
      loadingRef.current = false;
      clearQuestion();
      setTopic('');
      setAgeGroup(next);
    },
    [ageGroup, clearQuestion],
  );

  const askFor = useCallback(
    async (requestedTopic: string) => {
      // A shown question must be answered first, so a stray click or Enter cannot replace it.
      if (loadingRef.current || !ageGroup || status === 'awaiting_answer') return;
      const trimmed = requestedTopic.trim();
      if (!trimmed) {
        setMessage('צריך להקליד נושא כדי לקבל שאלה.');
        return;
      }
      // Offline: no request, and the question already on screen stays.
      if (isOffline()) {
        setMessage(OFFLINE_ERROR);
        return;
      }
      const requestId = crypto.randomUUID();
      activeRequestRef.current = requestId;
      loadingRef.current = true;
      setStatus('loading');
      setQuestion(null);
      setQuestionTopic(null);
      setSelectedOptionId(null);
      setMessage(null);
      const result = await fetchQuestion({
        ageGroup,
        topic: trimmed,
        requestId,
        previousQuestions: recentForTopic(seenRef.current, trimmed),
      });
      if (activeRequestRef.current !== requestId) return;
      activeRequestRef.current = null;
      loadingRef.current = false;
      if (!result.ok) {
        setMessage(result.message);
        setStatus('error');
      } else if (isSeen(seenRef.current, trimmed, result.question.prompt)) {
        // Checked against the full seen list, which may be longer than what the server received.
        setMessage(DUPLICATE_ERROR);
        setStatus('error');
      } else {
        markSeen(seenRef.current, trimmed, result.question.prompt);
        setQuestion(result.question);
        setQuestionTopic(trimmed);
        setStatus('awaiting_answer');
      }
    },
    [ageGroup, status],
  );

  const requestQuestion = useCallback(() => askFor(topic), [askFor, topic]);

  // Puts the question's topic back in the field, so "try again" after a failure stays on it.
  const requestMoreSameTopic = useCallback(async () => {
    if (!questionTopic) return;
    setTopic(questionTopic);
    await askFor(questionTopic);
  }, [askFor, questionTopic]);

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
      requestMoreSameTopic,
      selectAnswer,
    }),
    [
      ageGroup,
      changeAgeGroup,
      topic,
      status,
      question,
      selectedOptionId,
      message,
      requestQuestion,
      requestMoreSameTopic,
      selectAnswer,
    ],
  );
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameState {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used inside GameProvider');
  return context;
}
