import { Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { SessionListPage } from './pages/SessionListPage';
import { SessionCreatePage } from './pages/SessionCreatePage';
import { SessionDetailPage } from './pages/SessionDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { useInitialSession } from './hooks/useInitialSession';

export function App(): React.ReactNode {
  useInitialSession();

  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<SessionListPage />} />
          <Route path="new" element={<SessionCreatePage />} />
          <Route
            path="session/:commitSha"
            element={
              <ErrorBoundary label="session">
                <SessionDetailPage />
              </ErrorBoundary>
            }
          />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
