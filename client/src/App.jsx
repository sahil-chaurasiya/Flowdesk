import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import useAuthStore from './context/authStore';
import { ToastProvider } from './components/ui/index';
import { ThemeProvider } from './context/ThemeContext';

// Layouts
import AdminLayout from './components/layout/AdminLayout';
import ClientLayout from './components/layout/ClientLayout';
import AuthLayout from './components/layout/AuthLayout';

// Landing
import LandingPage from './pages/LandingPage';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';

// Admin / Team Pages
import AdminDashboard       from './pages/admin/Dashboard';
import ClientsPage          from './pages/admin/ClientsPage';
import ClientDetailPage     from './pages/admin/ClientDetailPage';
import TasksPage            from './pages/admin/TasksPage';
import TeamPage             from './pages/admin/TeamPage';
import TeamMemberDetailPage from './pages/admin/TeamMemberDetailPage';
import AdminMessagesPage    from './pages/admin/MessagesPage';
import UpdatesPage          from './pages/admin/UpdatesPage';
import ReportsAdminPage     from './pages/admin/ReportsPage';
import FilesAdminPage       from './pages/admin/FilesPage';
import LeadsAdminPage       from './pages/admin/LeadsPage';
import MyTasksPage          from './pages/admin/MyTasksPage';
import SocialAdminPage      from './pages/admin/SocialPage';

// ── NEW pages ──────────────────────────────────────────────────────────────────
import KanbanPage           from './pages/admin/KanbanPage';
import CalendarPage         from './pages/admin/CalendarPage';
import SettingsPage         from './pages/admin/SettingsPage';
import ActivityPage         from './pages/admin/ActivityPage';
import InternalLeadsPage    from './pages/admin/InternalLeadsPage';
import ApiLogsPage          from './pages/admin/ApiLogsPage';

// Client Pages
import ClientDashboard    from './pages/client/Dashboard';
import ClientUpdatesPage  from './pages/client/UpdatesPage';
import ClientFilesPage    from './pages/client/FilesPage';
import ClientReportsPage  from './pages/client/ReportsPage';
import ClientChatPage     from './pages/client/ChatPage';
import ClientRequestsPage from './pages/client/RequestsPage';
import ClientLeadsPage    from './pages/client/LeadsPage';
import ClientSocialPage   from './pages/client/SocialPage';

// Shared
import NotFoundPage  from './pages/NotFoundPage';
import LoadingScreen from './components/shared/LoadingScreen';

const TEAM_ROLES = ['admin', 'manager', 'performance_marketer', 'social_media_manager', 'video_editor', 'graphic_designer', 'copywriter'];

const ProtectedRoute = ({ children, roles }) => {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/unauthorized" replace />;
  return children;
};

const RoleRouter = () => {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'client') return <Navigate to="/portal/dashboard" replace />;
  return <Navigate to="/admin/dashboard" replace />;
};

export default function App() {
  const initialize = useAuthStore(s => s.initialize);

  useEffect(() => { initialize(); }, []);

  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <SocketProvider>
            <Routes>
              {/* Landing page */}
              <Route path="/" element={<LandingPage />} />

              {/* Auth */}
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<LoginPage />} />
              </Route>

              {/* Role redirect */}
              <Route path="/dashboard" element={<ProtectedRoute><RoleRouter /></ProtectedRoute>} />

              {/* Admin / Team Routes */}
              <Route path="/admin" element={
                <ProtectedRoute roles={TEAM_ROLES}>
                  <AdminLayout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard"  element={<AdminDashboard />} />
                <Route path="clients"    element={<ClientsPage />} />
                <Route path="clients/:id" element={<ClientDetailPage />} />
                <Route path="tasks"      element={<TasksPage />} />
                <Route path="my-tasks"   element={<MyTasksPage />} />
                <Route path="leads"      element={<LeadsAdminPage />} />
                <Route path="team"       element={<TeamPage />} />
                <Route path="team/:id"   element={<TeamMemberDetailPage />} />
                <Route path="messages"   element={<AdminMessagesPage />} />
                <Route path="messages/:clientId" element={<AdminMessagesPage />} />
                <Route path="updates"    element={<UpdatesPage />} />
                <Route path="reports"    element={<ReportsAdminPage />} />
                <Route path="files"      element={<FilesAdminPage />} />
                <Route path="social"     element={<SocialAdminPage />} />

                {/* ── NEW routes ──────────────────────────────────────────── */}
                <Route path="kanban"     element={<KanbanPage />} />
                <Route path="calendar"   element={<CalendarPage />} />
                <Route path="settings"   element={<SettingsPage />} />
                <Route path="activity"   element={<ActivityPage />} />

                {/* ── API Logs (admin only) ────────────────────────────── */}
                <Route path="logs" element={
                  <ProtectedRoute roles={['admin']}>
                    <ApiLogsPage />
                  </ProtectedRoute>
                } />

                {/* ── Internal Lead Management (admin + performance_marketer only) */}
                <Route path="internal-leads" element={
                  <ProtectedRoute roles={['admin', 'performance_marketer']}>
                    <InternalLeadsPage />
                  </ProtectedRoute>
                } />
              </Route>

              {/* Client Portal Routes */}
              <Route path="/portal" element={
                <ProtectedRoute roles={['client']}>
                  <ClientLayout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<ClientDashboard />} />
                <Route path="updates"   element={<ClientUpdatesPage />} />
                <Route path="files"     element={<ClientFilesPage />} />
                <Route path="reports"   element={<ClientReportsPage />} />
                <Route path="chat"      element={<ClientChatPage />} />
                <Route path="requests"  element={<ClientRequestsPage />} />
                <Route path="leads"     element={<ClientLeadsPage />} />
                <Route path="social"    element={<ClientSocialPage />} />
              </Route>

              <Route path="/unauthorized" element={
                <div className="flex h-screen items-center justify-center flex-col gap-3 text-[var(--fd-ink-2)]">
                  <div className="text-2xl font-bold text-[var(--fd-ink-1)]">Access Denied</div>
                  <p>You don&apos;t have permission to view that page.</p>
                  <a href="/login" className="text-brand-600 underline text-sm">Return to login</a>
                </div>
              } />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </SocketProvider>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
