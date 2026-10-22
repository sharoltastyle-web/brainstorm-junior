import type { QuestionOption } from '../api/questionsApi';
import styles from './AnswerOptions.module.css';

interface AnswerOptionsProps {
  labelledBy: string;
  options: QuestionOption[];
  selectedOptionId: string | null;
  // Only known after answering; never rendered before.
  isCorrect: boolean | null;
  onSelect: (optionId: string) => void;
}

export function AnswerOptions({ labelledBy, options, selectedOptionId, isCorrect, onSelect }: AnswerOptionsProps) {
  const locked = selectedOptionId !== null;
  return (
    <fieldset className={styles.group} disabled={locked} aria-labelledby={labelledBy}>
      {options.map((option) => {
        const selected = option.id === selectedOptionId;
        const stateClass = selected ? (isCorrect ? styles.correct : styles.wrong) : '';
        return (
          <label key={option.id} className={[styles.card, stateClass].filter(Boolean).join(' ')}>
            <input
              type="radio"
              name="answer"
              className={styles.radio}
              value={option.id}
              checked={selected}
              onChange={() => onSelect(option.id)}
            />
            <span className={styles.text}>{option.text}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
