import { useEffect, useRef, type FormEvent } from 'react';
import { AnswerOptions } from '../components/AnswerOptions';
import { Button } from '../components/Button';
import { FeedbackCard } from '../components/FeedbackCard';
import { useGame } from '../state/GameContext';
import styles from './TriviaPage.module.css';

const MAX_TOPIC_LENGTH = 120;
const SCROLL_DELAY_MS = 150;
const SCROLL_FALLBACK_MS = 1000;

export function TriviaPage() {
  const {
    topic,
    setTopic,
    status,
    question,
    selectedOptionId,
    message,
    requestQuestion,
    requestMoreSameTopic,
    selectAnswer,
  } = useGame();
  const loading = status === 'loading';
  const answered = status === 'answered' && question !== null && selectedOptionId !== null;
  const isCorrect = answered ? selectedOptionId === question.correctOptionId : null;
  const correctAnswer = question?.options.find((option) => option.id === question.correctOptionId)?.text ?? '';
  const resultRef = useRef<HTMLDivElement>(null);

  // On small screens the feedback appears below the fold; bring it (and the continue button) into view.
  useEffect(() => {
    if (!answered) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const scroll = (behavior: ScrollBehavior) => resultRef.current?.scrollIntoView?.({ behavior, block: 'nearest' });
    // Deferred: a smooth scroll started while the tap/click is still being handled gets cancelled by the browser.
    const smooth = setTimeout(() => scroll(reduceMotion ? 'auto' : 'smooth'), SCROLL_DELAY_MS);
    // Fallback: if the smooth scroll was interrupted anyway, jump there. 'nearest' does nothing when already in view.
    const fallback = setTimeout(() => scroll('auto'), SCROLL_FALLBACK_MS);
    return () => {
      clearTimeout(smooth);
      clearTimeout(fallback);
    };
  }, [answered]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void requestQuestion();
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>שאלות טריוויה</h1>

      <section className={styles.panel}>
        <form className={styles.topicForm} onSubmit={onSubmit} noValidate>
          <label htmlFor="topic" className={styles.topicLabel}>
            על איזה נושא נשחק?
          </label>
          <div className={styles.topicRow}>
            <input
              id="topic"
              className={styles.topicInput}
              type="text"
              value={topic}
              maxLength={MAX_TOPIC_LENGTH}
              autoComplete="off"
              onChange={(event) => setTopic(event.target.value)}
            />
            <Button
              type="submit"
              className={styles.askButton}
              disabled={loading || status === 'awaiting_answer'}
            >
              תנו לי שאלה
            </Button>
          </div>
        </form>

        {loading && (
          <p className={styles.status} role="status">
            מכינים לך שאלה...
          </p>
        )}
        {message && (
          <p className={styles.status} role="alert">
            {message}
          </p>
        )}

        {question && (status === 'awaiting_answer' || status === 'answered') && (
          <div className={styles.question}>
            <h2 id="question-prompt" className={styles.prompt}>
              {question.prompt}
            </h2>
            <AnswerOptions
              labelledBy="question-prompt"
              options={question.options}
              selectedOptionId={selectedOptionId}
              isCorrect={isCorrect}
              onSelect={selectAnswer}
            />
            {/* The solution and explanation are rendered only after answering. */}
            {answered && isCorrect !== null && (
              <div ref={resultRef} className={styles.result}>
                <FeedbackCard
                  isCorrect={isCorrect}
                  correctAnswer={correctAnswer}
                  explanation={question.explanation}
                />
                <Button
                  variant="secondary"
                  fullWidth
                  className={styles.moreButton}
                  onClick={() => void requestMoreSameTopic()}
                >
                  עוד שאלה באותו נושא
                </Button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
