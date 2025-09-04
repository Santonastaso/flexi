import React, { useEffect } from 'react';
import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import SideNav from './components/SideNav';
import MachineryListPage from './pages/MachineryListPage';
import MachineryFormPage from './pages/MachineryFormPage';
import MachineCalendarPage from './pages/MachineCalendarPage';
import PhasesListPage from './pages/PhasesListPage';
import PhasesFormPage from './pages/PhasesFormPage';
import BacklogListPage from './pages/BacklogListPage';
import BacklogFormPage from './pages/BacklogFormPage';
import SchedulerPage from './pages/SchedulerPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './auth/ProtectedRoute';
import ConfirmDialog from './components/ConfirmDialog';
import { useUIStore, useMainStore, useSchedulerStore } from './store';


// This component creates the main layout with the sidebar
const AppLayout = () => {
  const { confirmDialog, hideConfirmDialog, conflictDialog, hideConflictDialog } = useUIStore();
  const { cleanup } = useMainStore();
  const { resolveConflictByShunting } = useSchedulerStore();
  
  // Cleanup store when app unmounts
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);
  
  return (
    <div className="main-content">
      <SideNav />
      <div className="page-container">
        <main>
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
      {/* Conflict Resolution Dialog */}
      <ConfirmDialog 
        isOpen={conflictDialog.isOpen}
        title="Risoluzione Conflitto"
        message={conflictDialog.details ? 
          `Il lavoro "${conflictDialog.details.draggedTask?.odp_number}" si sovrappone con "${conflictDialog.details.conflictingTask?.odp_number}". Come vuoi procedere?` : 
          ''
        }
        type="warning"
        customButtons={[
          {
            text: 'Annulla',
            variant: 'secondary',
            onClick: hideConflictDialog
          },
          {
            text: 'Sposta a Sinistra ←',
            variant: 'primary',
            onClick: async () => {
              if (conflictDialog.details) {
                const result = await resolveConflictByShunting(conflictDialog.details, 'left');
                if (result.error) {
                  const { showError } = await import('./utils/toast');
                  showError(result.error);
                }
              }
            }
          },
          {
            text: 'Sposta a Destra →',
            variant: 'primary',
            onClick: async () => {
              if (conflictDialog.details) {
                const result = await resolveConflictByShunting(conflictDialog.details, 'right');
                if (result.error) {
                  const { showError } = await import('./utils/toast');
                  showError(result.error);
                }
              }
            }
          }
        ]}
      />
    </div>
  );
};

function App() {
  return (
    <ErrorBoundary>
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
          </Route>
        </Route>
        
        {/* Catch-all route for unmatched paths */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
