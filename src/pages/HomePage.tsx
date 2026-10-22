import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { useGame, type AgeGroup } from '../state/GameContext';
import styles from './HomePage.module.css';

const AGE_GROUPS: { value: AgeGroup; label: string }[] = [
  { value: '6-8', label: '6–8' },
  { value: '9-12', label: '9–12' },
];

export function HomePage() {
  const { ageGroup, setAgeGroup } = useGame();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<AgeGroup | null>(ageGroup);
  const [showMissing, setShowMissing] = useState(false);

  function start() {
    if (!selected) {
      setShowMissing(true);
      return;
    }
    setAgeGroup(selected);
    navigate('/trivia');
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.logoHeading}>
        <Logo />
      </h1>

      <img
        className={styles.hero}
        src="/images/hero.png"
        alt="מוח ורוד מחייך מחזיק נורה דולקת, עם כוכב לכת, טיל וטבע"
        width={1200}
        height={900}
      />

      <fieldset className={styles.ageFieldset}>
        <legend className={styles.ageTitle}>בוחרים קבוצת גיל</legend>
        <div className={styles.ageOptions}>
          {AGE_GROUPS.map(({ value, label }) => (
            <label
              key={value}
              className={selected === value ? `${styles.ageOption} ${styles.ageSelected}` : styles.ageOption}
            >
              <input
                type="radio"
                name="ageGroup"
                value={value}
                checked={selected === value}
                onChange={() => {
                  setSelected(value);
                  setShowMissing(false);
                }}
                className={styles.radio}
              />
              <bdi dir="ltr" className={styles.ageLabel}>
                {label}
              </bdi>
            </label>
          ))}
        </div>
        {showMissing && (
          <p role="alert" className={styles.missing}>
            צריך לבחור קבוצת גיל כדי להתחיל.
          </p>
        )}
      </fieldset>

      <Button fullWidth onClick={start}>
        מתחילים לשחק
      </Button>
    </div>
  );
}
