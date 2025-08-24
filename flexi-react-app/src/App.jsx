import React, { useEffect } from 'react';
import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import SideNav from './components/SideNav';
import MachineryPage from './pages/MachineryPage';
import MachineCalendarPage from './pages/MachineCalendarPage';
import PhasesPage from './pages/PhasesPage';
import BacklogPage from './pages/BacklogPage';
import SchedulerPage from './pages/SchedulerPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './auth/ProtectedRoute';
import Alert from './components/Alert';
import ConfirmDialog from './components/ConfirmDialog';
import { useUIStore, useMainStore } from './store';
import { useAuth } from './auth/AuthContext';

// This component creates the main layout with the sidebar
const AppLayout = () => {
  const { alert, hideAlert, confirmDialog, hideConfirmDialog } = useUIStore();
  const { cleanup } = useMainStore();
  
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
      <Alert 
        message={alert.message}
        type={alert.type}
        isVisible={alert.isVisible}
        onClose={hideAlert}
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
            <Route path="machinery" element={<MachineryPage />} />
            <Route path="machinery/:machineId/calendar" element={<MachineCalendarPage />} />
            <Route path="phases" element={<PhasesPage />} />
            <Route path="backlog" element={<BacklogPage />} />
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
