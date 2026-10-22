import styles from './FeedbackCard.module.css';

interface FeedbackCardProps {
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
}

// Icon and text carry the result too, so feedback never relies on color alone.
export function FeedbackCard({ isCorrect, correctAnswer, explanation }: FeedbackCardProps) {
  return (
    <div className={[styles.card, isCorrect ? styles.correct : styles.wrong].join(' ')} role="status">
      <span className={styles.icon} aria-hidden="true">
        {isCorrect ? '✓' : '✗'}
      </span>
      <div className={styles.body}>
        {isCorrect ? (
          <p className={styles.headline}>כל הכבוד! תשובה נכונה!</p>
        ) : (
          <>
            <p className={styles.headline}>הפעם לא הצלחת.</p>
            <p className={styles.answer}>התשובה הנכונה היא: {correctAnswer}</p>
          </>
        )}
        <p className={styles.explanation}>{explanation}</p>
      </div>
    </div>
  );
}
