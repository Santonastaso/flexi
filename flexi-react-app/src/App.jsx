import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import SideNav from './components/SideNav';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './auth/ProtectedRoute';
import ConfirmDialog from './components/ui/confirm-dialog';
import { useUIStore, useMainStore } from './store';
import { useAuth } from './auth/useAuth';

const MachineryListPage = lazy(() => import('./pages/MachineryListPage'));
const MachineryFormPage = lazy(() => import('./pages/MachineryFormPage'));
const MachineCalendarPage = lazy(() => import('./pages/MachineCalendarPage'));
const PhasesListPage = lazy(() => import('./pages/PhasesListPage'));
const PhasesFormPage = lazy(() => import('./pages/PhasesFormPage'));
const BacklogListPage = lazy(() => import('./pages/BacklogListPage'));
const BacklogFormPage = lazy(() => import('./pages/BacklogFormPage'));
const SchedulerPage = lazy(() => import('./pages/SchedulerPage'));
const SpotifySchedulerPage = lazy(() => import('./pages/SpotifySchedulerPage'));
const MachineOverviewPage = lazy(() => import('./pages/MachineOverviewPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));

const RouteLoading = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-100">
    <div className="flex flex-col items-center gap-3">
      <div className="animate-spin border-4 border-gray-200 border-t-blue-500 rounded-full w-8 h-8" />
      <p className="text-sm text-gray-500">Caricamento...</p>
    </div>
  </div>
);

// This component creates the main layout with the sidebar
const AppLayout = () => {
  const { confirmDialog, hideConfirmDialog, selectedWorkCenter } = useUIStore();
  const { cleanup } = useMainStore();
  const { user, signOut } = useAuth();
  
  // Cleanup store when app unmounts
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);
  
  return (
    <div className="flex h-screen bg-gray-200 overflow-hidden">
      <SideNav />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 bg-navy-800 border-b border-navy-700 px-2 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
            </div>
            <div className="flex items-center space-x-4">
              {user && (
                <>
                  <span className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded select-none">
                    {selectedWorkCenter}
                  </span>
                  <span className="text-xs text-navy-200">{user.email}</span>
                  <button 
                    onClick={signOut}
                    className="px-3 py-2 text-xs font-medium text-navy-200 hover:text-white hover:bg-navy-700 rounded transition-colors"
                  >
                    Esci
                  </button>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto pt-0 min-w-0">
          <Outlet />
        </main>
      </div>
      <Toaster 
        position="top-right"
        richColors
        closeButton
        duration={4000}
      />
      <ConfirmDialog 
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={() => {
          confirmDialog.onConfirm?.();
          hideConfirmDialog();
        }}
        onCancel={hideConfirmDialog}
        type={confirmDialog.type}
      />
    </div>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          {/* Public authentication routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Protected application routes */}
          <Route path="/" element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              {/* Define the component for the home page */}
              <Route index element={<HomePage />} />

              {/* Add routes for your migrated pages */}
              <Route path="machinery" element={<MachineryListPage />} />
              <Route path="machinery/add" element={<MachineryFormPage />} />
              <Route path="machinery/:id/edit" element={<MachineryFormPage />} />
              <Route path="machinery/:machineId/calendar" element={<MachineCalendarPage />} />
              <Route path="phases" element={<PhasesListPage />} />
              <Route path="phases/add" element={<PhasesFormPage />} />
              <Route path="phases/:id/edit" element={<PhasesFormPage />} />
              <Route path="backlog" element={<BacklogListPage />} />
              <Route path="backlog/add" element={<BacklogFormPage />} />
              <Route path="backlog/:id/edit" element={<BacklogFormPage />} />
              <Route path="scheduler" element={<SchedulerPage />} />
              <Route path="spotify-scheduler" element={<SpotifySchedulerPage />} />
              <Route path="machine-overview" element={<MachineOverviewPage />} />
            </Route>
          </Route>

          {/* Catch-all route for unmatched paths */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
