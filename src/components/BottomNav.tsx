import { NavLink } from 'react-router-dom';
import styles from './BottomNav.module.css';

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 2 11.5h3V21h5.5v-6h3v6H19v-9.5h3L12 3Z" fill="currentColor" />
    </svg>
  );
}

function QuestionIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.5c-3.6 0-6.2 2.2-6.4 5.6h3.6c.1-1.4 1.2-2.4 2.7-2.4 1.6 0 2.6.9 2.6 2.2 0 1.2-.6 1.8-2 2.7-1.7 1-2.5 2.2-2.4 4.2v.7h3.5v-.6c0-1.2.4-1.7 1.9-2.6 1.7-1 2.8-2.4 2.8-4.5 0-3.2-2.6-5.3-6.3-5.3Zm-.3 15a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="currentColor" />
      <circle cx="12" cy="7" r="1.6" fill="#fff" />
      <rect x="10.5" y="10" width="3" height="8" rx="1.2" fill="#fff" />
    </svg>
  );
}

const ITEMS = [
  { to: '/', label: 'בית', Icon: HomeIcon },
  { to: '/trivia', label: 'טריוויה', Icon: QuestionIcon },
  { to: '/about', label: 'אודות', Icon: InfoIcon },
];

export function BottomNav() {
  return (
    <nav className={styles.nav} aria-label="ניווט ראשי">
      <ul className={styles.list}>
        {ITEMS.map(({ to, label, Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end
              className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
            >
              <Icon />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
