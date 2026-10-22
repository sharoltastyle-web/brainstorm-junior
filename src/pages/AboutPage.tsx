import { Logo } from '../components/Logo';
import styles from './AboutPage.module.css';

const STEPS = [
  'בוחרים קבוצת גיל במסך הבית.',
  'מקלידים נושא ומבקשים שאלה.',
  'בוחרים תשובה אחת מתוך ארבע.',
  'מקבלים משוב והסבר קצר.',
  'ממשיכים לעוד שאלה באותו נושא או בוחרים נושא חדש.',
];

export function AboutPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>אודות</h1>
      <Logo className={styles.logo} />

      <p className={styles.intro}>משחק טריוויה לגילי 6 עד 12. מגלים דברים חדשים בנושאים שמעניינים אתכם.</p>

      <section className={styles.howTo}>
        <h2 className={styles.subtitle}>איך משחקים?</h2>
        <ul className={styles.steps}>
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </section>

      <img className={styles.illustration} src="/images/about.png" alt="" width={1200} height={600} />
    </div>
  );
}
