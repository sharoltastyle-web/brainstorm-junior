import { Navigate, Route, Routes } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { AboutPage } from './pages/AboutPage';
import { HomePage } from './pages/HomePage';
import { TriviaPage } from './pages/TriviaPage';
import { useGame } from './state/GameContext';
import styles from './App.module.css';

function RequireAgeGroup({ children }: { children: React.ReactNode }) {
  const { ageGroup } = useGame();
  if (!ageGroup) return <Navigate to="/" replace />;
  return children;
}

export function App() {
  return (
    <div className={styles.shell}>
      <main className={styles.content}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/trivia"
            element={
              <RequireAgeGroup>
                <TriviaPage />
              </RequireAgeGroup>
            }
          />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
