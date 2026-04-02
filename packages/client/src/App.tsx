import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { SessionListPage } from './pages/SessionListPage';
import { SessionCreatePage } from './pages/SessionCreatePage';
import { SessionDetailPage } from './pages/SessionDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { useInitialSession } from './hooks/useInitialSession';

export function App() {
  useInitialSession();

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<SessionListPage />} />
        <Route path="new" element={<SessionCreatePage />} />
        <Route path="session/:commitSha" element={<SessionDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
