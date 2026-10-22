import { useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { useGame } from '../state/GameContext';
import styles from './TriviaPage.module.css';

const MAX_TOPIC_LENGTH = 120;
const GENERIC_ERROR = 'משהו השתבש. נסו שוב.';

export function TriviaPage() {
  const { ageGroup, topic, setTopic } = useGame();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestQuestion(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    const trimmed = topic.trim();
    if (!trimmed) {
      setMessage('צריך להקליד נושא כדי לקבל שאלה.');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      // M1: the endpoint only confirms the frontend reaches the backend; questions arrive in M2.
      const response = await fetch('/api/v1/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ageGroup, topic: trimmed, requestId: crypto.randomUUID() }),
      });
      const data: unknown = await response.json().catch(() => null);
      const errorMessage =
        data && typeof data === 'object' && 'error' in data
          ? (data as { error: { message?: unknown } }).error.message
          : null;
      setMessage(typeof errorMessage === 'string' ? errorMessage : GENERIC_ERROR);
    } catch {
      setMessage(GENERIC_ERROR);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>שאלות טריוויה</h1>

      <section className={styles.panel}>
        <form className={styles.topicForm} onSubmit={requestQuestion} noValidate>
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
            <Button type="submit" className={styles.askButton} disabled={loading}>
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
      </section>
    </div>
  );
}
