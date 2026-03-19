import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { SessionListPage } from './pages/SessionListPage';
import { SessionCreatePage } from './pages/SessionCreatePage';
import { SessionDetailPage } from './pages/SessionDetailPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<SessionListPage />} />
        <Route path="new" element={<SessionCreatePage />} />
        <Route path="session/:commitSha" element={<SessionDetailPage />} />
      </Route>
    </Routes>
  );
}
