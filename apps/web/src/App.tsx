import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProgramsListPage } from './pages/ProgramsListPage';
import { ProgramFormPage } from './pages/ProgramFormPage';
import { ProgramDetailPage } from './pages/ProgramDetailPage';
import { ApacheStatusPage } from './pages/ApacheStatusPage';
import { BackupsPage } from './pages/BackupsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { DevicesPage } from './pages/DevicesPage';
import { UsersPage } from './pages/UsersPage';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="center-loading">불러오는 중...</p>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="programs" element={<ProgramsListPage />} />
        <Route path="programs/new" element={<ProgramFormPage />} />
        <Route path="programs/:id" element={<ProgramDetailPage />} />
        <Route path="programs/:id/edit" element={<ProgramFormPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="apache" element={<ApacheStatusPage />} />
        <Route path="backups" element={<BackupsPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="users" element={<UsersPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
